import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ReturnItem, MasterProduct } from '../types/inventory';
import { Camera, RefreshCw, X, AlertCircle, CheckCircle2, Search, Plus, Volume2, Database } from 'lucide-react';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: ReturnItem[];
  masterProducts?: MasterProduct[];
  onSelectScannedItem?: (item: ReturnItem) => void;
  onBarcodeNotFound?: (barcode: string) => void;
  onMasterProductFound?: (product: MasterProduct) => void;
  onBarcodeDetected?: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items = [],
  masterProducts = [],
  onSelectScannedItem,
  onBarcodeNotFound,
  onMasterProductFound,
  onBarcodeDetected,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<{
    code: string;
    foundItem?: ReturnItem;
    foundMaster?: MasterProduct;
  } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isComponentMounted = useRef(true);

  // Play crisp synthetic audio beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext may be blocked before gesture
    }
  };

  const handleBarcodeDecoded = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    playBeep();
    if (navigator.vibrate) {
      navigator.vibrate([80, 50, 80]);
    }

    // Stop camera once decoded
    stopCamera();

    // Check if item exists in inventory
    const matchedItem = items.find(
      (item) => item.barcode.toLowerCase() === cleanCode.toLowerCase()
    );

    // Check if item exists in master products
    const matchedMaster = masterProducts.find(
      (p) => p.barcode.toLowerCase() === cleanCode.toLowerCase()
    );

    setScannedResult({
      code: cleanCode,
      foundItem: matchedItem,
      foundMaster: matchedMaster,
    });

    if (onBarcodeDetected) {
      onBarcodeDetected(cleanCode);
    }
  };

  const startCamera = async () => {
    setErrorMessage(null);
    setScannedResult(null);

    const element = document.getElementById('barcode-camera-box');
    if (!element) return;

    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode('barcode-camera-box', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.3333,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleBarcodeDecoded(decodedText);
        },
        () => {
          // Frame error (no barcode detected yet) - ignore normal frames
        }
      );

      if (isComponentMounted.current) {
        setIsScanning(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isComponentMounted.current) {
        setIsScanning(false);
        setErrorMessage(
          'Tidak dapat mengakses kamera. Pastikan izin kamera aktif atau gunakan input barcode manual di bawah.'
        );
      }
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    if (isComponentMounted.current) {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen) {
      // Start camera after DOM modal opens
      const timer = setTimeout(() => {
        startCamera();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
      setScannedResult(null);
      setManualCode('');
    }
    return () => {
      isComponentMounted.current = false;
      stopCamera();
    };
  }, [isOpen]);

  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDecoded(manualCode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-neutral-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-base tracking-tight">
              Pemindai Barcode Barang Return
            </h2>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Result Banner if Scanned */}
          {scannedResult ? (
            <div className="p-4 rounded-lg border bg-neutral-50 space-y-3">
              <div className="flex items-start gap-3">
                {scannedResult.foundItem ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Hasil Pemindaian Barcode
                  </div>
                  <div className="text-lg font-mono font-bold text-neutral-900">
                    {scannedResult.code}
                  </div>

                  {scannedResult.foundItem ? (
                    <div className="mt-2 text-sm space-y-1 text-neutral-700 bg-white p-3 rounded border border-neutral-200">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block mb-1">
                        Terdaftar di Gudang (Barang Retur Aktif)
                      </div>
                      <div className="font-semibold text-neutral-900 text-base">
                        {scannedResult.foundItem.itemName}
                      </div>
                      <div className="text-xs text-neutral-600">
                        Supplier: <span className="font-medium text-neutral-800">{scannedResult.foundItem.supplierName}</span>
                      </div>
                      <div className="text-xs text-neutral-600">
                        Qty: <span className="font-semibold text-neutral-900">{scannedResult.foundItem.quantity} {scannedResult.foundItem.unit}</span> · Lokasi: <span className="font-medium text-neutral-800">{scannedResult.foundItem.locationSlot}</span>
                      </div>
                      <div className="text-xs text-neutral-600">
                        Status:{' '}
                        <span
                          className={`font-semibold ${
                            scannedResult.foundItem.status === 'Lewat Tenggat'
                              ? 'text-rose-600'
                              : scannedResult.foundItem.status === 'Mendekati Tenggat'
                              ? 'text-amber-600'
                              : scannedResult.foundItem.status === 'Sudah Diambil'
                              ? 'text-emerald-600'
                              : 'text-sky-600'
                          }`}
                        >
                          {scannedResult.foundItem.status}
                        </span>
                      </div>
                    </div>
                  ) : scannedResult.foundMaster ? (
                    <div className="mt-2 text-sm space-y-1.5 text-neutral-700 bg-emerald-50/70 p-3 rounded-lg border border-emerald-300">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ditemukan di Database Master Produk (XLSX)</span>
                      </div>
                      <div className="font-semibold text-neutral-900 text-base">
                        {scannedResult.foundMaster.itemName}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 pt-1">
                        <div>
                          Dept: <strong className="text-neutral-800">{scannedResult.foundMaster.department}</strong>
                        </div>
                        <div>
                          SKU: <strong className="font-mono text-neutral-800">{scannedResult.foundMaster.sku || '-'}</strong>
                        </div>
                        <div className="col-span-2">
                          Suplier: <strong className="text-neutral-800">{scannedResult.foundMaster.supplierName}</strong>
                        </div>
                      </div>
                      <div className="text-[11px] text-emerald-700 pt-1 font-medium">
                        ✓ Informasi produk siap terisi otomatis ke form return.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-neutral-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <div className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Produk Tidak Ditemukan dalam Database Master XLSX</span>
                      </div>
                      <p>
                        Barcode ini <strong>belum terdaftar</strong> di database master XLSX maupun data gudang. Anda dapat langsung menginput data baru sekarang.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions for Scanned Item */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-200">
                {scannedResult.foundItem ? (
                  <>
                    <button
                      onClick={() => {
                        if (onSelectScannedItem) onSelectScannedItem(scannedResult.foundItem!);
                        onClose();
                      }}
                      className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      Buka Detail & Peringatan Supplier
                    </button>
                    <button
                      onClick={() => {
                        if (scannedResult.foundMaster && onMasterProductFound) {
                          onMasterProductFound(scannedResult.foundMaster);
                        } else if (onBarcodeNotFound) {
                          onBarcodeNotFound(scannedResult.code);
                        }
                        onClose();
                      }}
                      className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-xs font-semibold"
                    >
                      + Input Retur Baru
                    </button>
                  </>
                ) : scannedResult.foundMaster ? (
                  <button
                    onClick={() => {
                      if (onMasterProductFound) {
                        onMasterProductFound(scannedResult.foundMaster!);
                      } else if (onBarcodeNotFound) {
                        onBarcodeNotFound(scannedResult.code);
                      }
                      onClose();
                    }}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Input Retur Barang Ini (Autofill Otomatis)
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (onBarcodeNotFound) onBarcodeNotFound(scannedResult.code);
                      onClose();
                    }}
                    className="flex-1 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Input Sebagai Barang Return Baru
                  </button>
                )}

                <button
                  onClick={() => {
                    setScannedResult(null);
                    startCamera();
                  }}
                  className="px-3 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Scan Ulang
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Camera Live Viewport */}
              <div className="relative rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center min-h-[240px]">
                <div id="barcode-camera-box" className="w-full h-full min-h-[220px]" />

                {!isScanning && !errorMessage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 text-neutral-300 p-4 text-center">
                    <Camera className="w-8 h-8 text-neutral-400 mb-2 animate-pulse" />
                    <p className="text-sm font-medium">Menghubungkan ke kamera perangkat...</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Arahkan barcode / QR code barang ke tengah kamera
                    </p>
                  </div>
                )}

                {errorMessage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/95 text-neutral-200 p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-sm font-medium text-amber-200">{errorMessage}</p>
                    <button
                      onClick={startCamera}
                      className="mt-3 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-xs font-semibold text-neutral-200 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Coba Buka Kamera Lagi
                    </button>
                  </div>
                )}

                {isScanning && (
                  <div className="absolute top-2 right-2 bg-neutral-900/80 backdrop-blur-xs text-neutral-200 px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 border border-neutral-700/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Kamera Aktif
                  </div>
                )}
              </div>

              <div className="text-xs text-neutral-500 text-center flex items-center justify-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Bunyi *beep* otomatis berbunyi ketika barcode terdeteksi</span>
              </div>
            </>
          )}

          {/* Manual Input & Simulation section */}
          <div className="border-t border-neutral-200 pt-4">
            <div className="text-xs font-semibold text-neutral-700 mb-2 flex items-center justify-between">
              <span>Input Barcode Manual / Scanner Gun USB</span>
              <span className="text-[11px] font-normal text-neutral-500">Mendukung Gun Scanner Otomatis</span>
            </div>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ketik atau scan barcode (e.g. 8992753210118)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-sm font-medium transition-colors shrink-0"
              >
                Cari Barcode
              </button>
            </form>

            {/* Quick Test Barcode Buttons for easy testing on PC/Mobile */}
            <div className="mt-3">
              <div className="text-[11px] font-medium text-neutral-500 mb-1.5">
                Barcode Contoh Cepat untuk Uji Coba:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setManualCode(item.barcode);
                      handleBarcodeDecoded(item.barcode);
                    }}
                    className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-xs font-mono transition-colors text-left truncate max-w-[200px]"
                    title={`${item.itemName} (${item.barcode})`}
                  >
                    {item.barcode} ({item.itemName.slice(0, 15)}...)
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-sm font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
