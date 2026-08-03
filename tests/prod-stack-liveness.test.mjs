/**
 * Regresja wykrywalności: „proces żyje, port zbindowany, zero odpowiedzi".
 *
 * ══ Co dokładnie jest tu bronione ══
 * Zgłoszenie PO: prod-build storefrontu przestaje odpowiadać, ale PROCES ŻYJE
 * i PORT ZOSTAJE ZBINDOWANY, więc monitoring typu „czy port odpowiada" pokazuje
 * zieleń na martwym serwisie.
 *
 * Zastana `startAndAssertBind` NIE łapie tego stanu i nie jest to jej wina —
 * ona weryfikuje bind i TOŻSAMOŚĆ builda, robiąc to RAZ (przed pomiarem) i na
 * `/_next/static/<BUILD_ID>/_ssgManifest.js`, czyli na PLIKU Z DYSKU. Serwer
 * z zakleszczonym pipeline'em SSR dalej odda ten plik. Test poniżej odtwarza
 * dokładnie taki serwer i pokazuje OBIE strony faktu:
 *   • statyk odpowiada 200 (więc bramka na bindzie przepuściłaby ten stan),
 *   • trasa SSR nie odpowiada w budżecie ⇒ `assertServerStillServing` FAIL.
 *
 * RED-FIRST: bez `assertServerStillServing` w prod-stack-lifecycle.mjs ten plik
 * nie importuje się (ERR_MODULE_NOT_FOUND / undefined), więc jest czerwony
 * zanim powstanie funkcja — a nie dopiero „gdyby ktoś zepsuł".
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { NeedsLiveRun, assertServerStillServing } from '../scripts/lib/prod-stack-lifecycle.mjs';

const BUILD_ID = 'test-build-id';

/**
 * Serwer odtwarzający objaw: akceptuje połączenia, oddaje statyk, a na trasy
 * SSR NIE ODPOWIADA NIGDY (socket zostaje otwarty — to zator, nie błąd).
 */
function startWedgedServer({ wedged = true, emptyBody = false } = {}) {
  const held = [];
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/_next/static/')) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end('self.__SSG_MANIFEST=new Set();');
      return;
    }
    if (wedged) {
      // Ani odpowiedzi, ani zamknięcia — dokładnie „curl wisi".
      held.push(res);
      return;
    }
    if (emptyBody) {
      // Catch-all zwracający puste 200. Samo `status === 200` NIE jest dowodem
      // renderu, więc to też musi być FAIL.
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><html lang="pl"><body>strona</body></html>');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () => {
          for (const res of held) res.destroy();
          return new Promise((r) => server.close(r));
        }
      });
    });
  });
}

test('zakleszczony SSR przy żywym porcie i działającym statyku ⇒ FAIL (nie zieleń)', async () => {
  const srv = await startWedgedServer({ wedged: true });
  try {
    // Kontrola pozytywna: statyk ŻYJE, więc bramka oparta na bindzie
    // przepuściłaby ten serwer jako zdrowy.
    const staticRes = await fetch(
      `http://127.0.0.1:${srv.port}/_next/static/${BUILD_ID}/_ssgManifest.js`
    );
    assert.equal(staticRes.status, 200, 'statyk musi odpowiadać — to jest właśnie pułapka');
    await staticRes.text();

    await assert.rejects(
      () => assertServerStillServing(srv.port, { paths: ['/pl'], budgetMs: 1500, buildId: BUILD_ID }),
      (err) => {
        assert.ok(err instanceof NeedsLiveRun, `oczekiwano NeedsLiveRun, dostano ${err?.constructor?.name}`);
        assert.match(err.message, /przestał renderować/);
        assert.match(err.message, /STATYK ODPOWIADA/, 'komunikat musi nazwać sygnaturę statyk-200/SSR-martwy');
        return true;
      }
    );
  } finally {
    await srv.close();
  }
});

test('puste 200 z catch-all NIE jest dowodem renderu ⇒ FAIL', async () => {
  const srv = await startWedgedServer({ wedged: false, emptyBody: true });
  try {
    await assert.rejects(
      () => assertServerStillServing(srv.port, { paths: ['/pl'], budgetMs: 1500 }),
      (err) => {
        assert.ok(err instanceof NeedsLiveRun);
        assert.match(err.message, /rendered=false/);
        return true;
      }
    );
  } finally {
    await srv.close();
  }
});

test('serwer realnie renderujący ⇒ PASS z asercją do evidence', async () => {
  const srv = await startWedgedServer({ wedged: false });
  try {
    const assertion = await assertServerStillServing(srv.port, {
      paths: ['/pl', '/de'],
      budgetMs: 5000,
      buildId: BUILD_ID
    });
    assert.equal(assertion.ok, true);
    assert.equal(assertion.probes.length, 2);
    for (const p of assertion.probes) {
      assert.equal(p.status, 200);
      assert.equal(p.looks_rendered, true);
    }
    assert.equal(assertion.static_control.status, 200);
  } finally {
    await srv.close();
  }
});

test('martwy listener (port zamknięty) ⇒ FAIL, nie cichy PASS', async () => {
  const srv = await startWedgedServer({ wedged: false });
  const port = srv.port;
  await srv.close();
  await assert.rejects(
    () => assertServerStillServing(port, { paths: ['/pl'], budgetMs: 1500 }),
    (err) => {
      assert.ok(err instanceof NeedsLiveRun);
      return true;
    }
  );
});
