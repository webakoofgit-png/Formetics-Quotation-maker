import suppliedLogo from "@/assets/formatix-logo.png?inline";

export const FORMATIX_LOGO = suppliedLogo;
// Present the supplied logo's artwork panel; the original image is kept unchanged.
export const LOGO_PANEL = {
  x: 401,
  y: 1604,
  width: 2573,
  height: 1011,
  sourceWidth: 3375,
  sourceHeight: 4219,
};

// Render the same artwork viewport for PDF output, keeping the uploaded asset intact.
export async function pdfLogo() {
  if (typeof CanvasRenderingContext2D === "undefined") return { data: FORMATIX_LOGO, panel: false };
  const image = new Image();
  image.src = FORMATIX_LOGO;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = Math.round((1200 * LOGO_PANEL.height) / LOGO_PANEL.width);
  const context = canvas.getContext("2d");
  if (!context) return { data: FORMATIX_LOGO, panel: false };
  context.fillStyle = "#101012";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    LOGO_PANEL.x,
    LOGO_PANEL.y,
    LOGO_PANEL.width,
    LOGO_PANEL.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return { data: canvas.toDataURL("image/jpeg", 0.95), panel: true };
}
