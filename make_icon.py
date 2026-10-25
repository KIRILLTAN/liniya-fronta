"""Рисует значок приложения (прицел над картой) в app.ico."""
from PIL import Image, ImageDraw

S = 256
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((8, 8, S - 8, S - 8), radius=44, fill=(16, 23, 30, 255), outline=(227, 179, 65, 255), width=10)
c, r = S // 2, 74
d.ellipse((c - r, c - r, c + r, c + r), outline=(227, 179, 65, 255), width=12)
d.ellipse((c - 14, c - 14, c + 14, c + 14), fill=(229, 83, 75, 255))
for x1, y1, x2, y2 in ((c, 36, c, 92), (c, S - 92, c, S - 36), (36, c, 92, c), (S - 92, c, S - 36, c)):
    d.line((x1, y1, x2, y2), fill=(227, 179, 65, 255), width=12)
img.save('app.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
