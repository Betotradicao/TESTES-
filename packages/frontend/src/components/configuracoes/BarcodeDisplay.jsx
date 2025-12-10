import Barcode from 'react-barcode';

export default function BarcodeDisplay({ value }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex justify-center items-center p-4 bg-white border border-gray-200 rounded-md">
      <Barcode
        value={value}
        format="CODE128"
        width={2}
        height={60}
        displayValue={true}
        fontSize={14}
        margin={10}
      />
    </div>
  );
}
