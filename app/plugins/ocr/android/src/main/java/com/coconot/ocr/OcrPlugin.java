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

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

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
        // The camera preview plugin displays a center-cropped view but
        // captureSample() returns the full uncropped frame.
        int vpW = call.getInt("viewportWidth", 0);
        int vpH = call.getInt("viewportHeight", 0);

        if (vpW > 0 && vpH > 0) {
            bitmap = centerCropToAspect(bitmap, vpW, vpH);
        }

        int imgWidth = bitmap.getWidth();
        int imgHeight = bitmap.getHeight();

        InputImage image = InputImage.fromBitmap(bitmap, 0);
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

        recognizer.process(image)
            .addOnSuccessListener(visionText -> {
                JSArray words = new JSArray();

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

                JSObject result = new JSObject();
                result.put("words", words);
                call.resolve(result);
            })
            .addOnFailureListener(e -> {
                call.reject("ML Kit text recognition failed: " + e.getMessage());
            });
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
            // Frame is wider than viewport — crop horizontally
            cropH = srcH;
            cropW = (int) (srcH * targetAspect);
            cropX = (srcW - cropW) / 2;
            cropY = 0;
        } else {
            // Frame is taller than viewport — crop vertically
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
