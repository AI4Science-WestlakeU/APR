export function drawHatchFallback(output, source, width, height) {
  output.save();
  output.clearRect(0, 0, width, height);
  output.drawImage(source, 0, 0, width, height);
  output.globalCompositeOperation = "destination-in";
  output.beginPath();
  for (let y = 2.5; y < height; y += 5) output.rect(0, y - 0.75, width, 1.5);
  output.fill();
  output.restore();
}
