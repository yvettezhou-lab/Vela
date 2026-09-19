import sharp from "sharp";

await sharp("public/vela-icon.svg")
  .resize(180, 180, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile("public/apple-touch-icon.png");
