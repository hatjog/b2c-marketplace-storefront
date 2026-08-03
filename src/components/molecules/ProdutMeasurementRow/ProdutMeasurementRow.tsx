import type { SingleProductMeasurement } from '@/types/product';

export const ProdutMeasurementRow = ({
  measurement
}: {
  measurement: SingleProductMeasurement;
}) => {
  const { label, inches, cm } = measurement;
  return (
    <div className="label-md grid grid-cols-3 rounded-sm border text-center">
      <div className="border-r py-3">{label}</div>
      <div className="border-r py-3">{inches} in</div>
      <div className="py-3">{cm} cm</div>
    </div>
  );
};
