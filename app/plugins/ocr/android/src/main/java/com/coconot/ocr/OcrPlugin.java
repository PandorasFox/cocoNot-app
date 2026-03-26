package com.coconot.ocr;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void recognizeText(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null) {
            call.reject("Missing base64 parameter");
            return;
        }

        // Strip data URI prefix if present
        int commaIdx = base64.indexOf(",");
        if (commaIdx >= 0) {
            base64 = base64.substring(commaIdx + 1);
        }

        byte[] imageData = Base64.decode(base64, Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(imageData, 0, imageData.length);
        if (bitmap == null) {
            call.reject("Could not decode base64 image");
            return;
        }

        // Center-crop the frame to match the viewport aspect ratio.
        int vpW = call.getInt("viewportWidth", 0);
        int vpH = call.getInt("viewportHeight", 0);

        if (vpW > 0 && vpH > 0) {
            bitmap = centerCropToAspect(bitmap, vpW, vpH);
        }

        final int imgWidth = bitmap.getWidth();
        final int imgHeight = bitmap.getHeight();

        InputImage image = InputImage.fromBitmap(bitmap, 0);

        // Run text recognition and barcode scanning in parallel
        TextRecognizer textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        BarcodeScanner barcodeScanner = BarcodeScanning.getClient(
            new BarcodeScannerOptions.Builder()
                .enableAllPotentialBarcodes()
                .build()
        );

        Task<Text> textTask = textRecognizer.process(image);
        Task<List<Barcode>> barcodeTask = barcodeScanner.process(image);

        Tasks.whenAllComplete(textTask, barcodeTask)
            .addOnCompleteListener(executor, tasks -> {
                JSArray words = new JSArray();
                JSArray barcodes = new JSArray();

                // Collect text results
                if (textTask.isSuccessful()) {
                    Text visionText = textTask.getResult();
                    for (Text.TextBlock block : visionText.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            for (Text.Element element : line.getElements()) {
                                android.graphics.Rect box = element.getBoundingBox();
                                if (box == null) continue;

                                JSObject word = new JSObject();
                                word.put("text", element.getText());
                                word.put("x", (double) box.left / imgWidth);
                                word.put("y", (double) box.top / imgHeight);
                                word.put("w", (double) box.width() / imgWidth);
                                word.put("h", (double) box.height() / imgHeight);
                                words.put(word);
                            }
                        }
                    }
                }

                // Collect barcode results
                if (barcodeTask.isSuccessful()) {
                    for (Barcode barcode : barcodeTask.getResult()) {
                        android.graphics.Rect box = barcode.getBoundingBox();
                        String rawValue = barcode.getRawValue();
                        if (box == null || rawValue == null) continue;

                        JSObject bc = new JSObject();
                        bc.put("value", rawValue);
                        bc.put("format", formatName(barcode.getFormat()));
                        bc.put("x", (double) box.left / imgWidth);
                        bc.put("y", (double) box.top / imgHeight);
                        bc.put("w", (double) box.width() / imgWidth);
                        bc.put("h", (double) box.height() / imgHeight);
                        barcodes.put(bc);
                    }
                }

                JSObject result = new JSObject();
                result.put("words", words);
                result.put("barcodes", barcodes);
                call.resolve(result);
            });
    }

    private static String formatName(int format) {
        switch (format) {
            case Barcode.FORMAT_CODE_128: return "CODE_128";
            case Barcode.FORMAT_CODE_39: return "CODE_39";
            case Barcode.FORMAT_CODE_93: return "CODE_93";
            case Barcode.FORMAT_CODABAR: return "CODABAR";
            case Barcode.FORMAT_EAN_13: return "EAN_13";
            case Barcode.FORMAT_EAN_8: return "EAN_8";
            case Barcode.FORMAT_ITF: return "ITF";
            case Barcode.FORMAT_UPC_A: return "UPC_A";
            case Barcode.FORMAT_UPC_E: return "UPC_E";
            case Barcode.FORMAT_QR_CODE: return "QR_CODE";
            case Barcode.FORMAT_DATA_MATRIX: return "DATA_MATRIX";
            case Barcode.FORMAT_AZTEC: return "AZTEC";
            case Barcode.FORMAT_PDF417: return "PDF417";
            default: return "UNKNOWN";
        }
    }

    /**
     * Center-crop a bitmap to match the target aspect ratio.
     * Mirrors the center-crop that the camera preview applies for display.
     */
    private static Bitmap centerCropToAspect(Bitmap src, int targetW, int targetH) {
        int srcW = src.getWidth();
        int srcH = src.getHeight();
        double srcAspect = (double) srcW / srcH;
        double targetAspect = (double) targetW / targetH;

        int cropW, cropH, cropX, cropY;

        if (srcAspect > targetAspect) {
            cropH = srcH;
            cropW = (int) (srcH * targetAspect);
            cropX = (srcW - cropW) / 2;
            cropY = 0;
        } else {
            cropW = srcW;
            cropH = (int) (srcW / targetAspect);
            cropX = 0;
            cropY = (srcH - cropH) / 2;
        }

        if (cropW == srcW && cropH == srcH) {
            return src;
        }

        return Bitmap.createBitmap(src, cropX, cropY, cropW, cropH);
    }
}
