import { formatKeyParityReport, compareMessageKeyParity } from '../src/lib/i18n/keyParity';
import deMessages from '../messages/de.json';
import enMessages from '../messages/en.json';
import plMessages from '../messages/pl.json';
import uaMessages from '../messages/ua.json';

const report = compareMessageKeyParity([
  { locale: 'pl', messages: plMessages },
  { locale: 'en', messages: enMessages },
  { locale: 'ua', messages: uaMessages },
  { locale: 'de', messages: deMessages },
]);

const output = formatKeyParityReport(report);

if (report.missing.length > 0) {
  console.error(output);
  process.exit(1);
}

process.stdout.write(`${output}\n`);
