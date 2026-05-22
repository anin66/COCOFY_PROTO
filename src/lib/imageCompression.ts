/**
 * Compresses an image file client-side using the Canvas API.
 * Scales the image so its maximum dimension is 1024px and encodes it as a JPEG at 70% quality.
 * If the file is not an image or if compression fails, the original file is returned.
 */
export function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    try {
      // Only compress images
      if (!file.type.startsWith("image/")) {
        return resolve(file);
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      img.onload = () => {
        try {
          // Revoke the object URL to avoid memory leaks
          URL.revokeObjectURL(objectUrl);

          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions keeping the aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.warn("Could not get 2D context from canvas");
            return resolve(file);
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              try {
                if (!blob) {
                  console.warn("toBlob returned null blob");
                  return resolve(file);
                }

                // Create a new filename with .jpg extension
                let name = file.name;
                const lastDot = name.lastIndexOf(".");
                if (lastDot !== -1) {
                  name = name.substring(0, lastDot) + ".jpg";
                } else {
                  name = name + ".jpg";
                }

                const compressedFile = new File([blob], name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                
                resolve(compressedFile);
              } catch (err) {
                console.error("Error creating File from blob:", err);
                resolve(file);
              }
            },
            "image/jpeg",
            0.7 // 70% JPEG quality
          );
        } catch (err) {
          console.error("Error inside img.onload:", err);
          resolve(file);
        }
      };

      img.onerror = (err) => {
        console.error("Error loading image for compression:", err);
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {}
        resolve(file);
      };
    } catch (err) {
      console.error("General error in compressImage:", err);
      resolve(file);
    }
  });
}
