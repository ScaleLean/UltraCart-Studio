"""Rebuild the app icon from its geometric mark. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

root = Path(__file__).resolve().parent.parent
size = 1024
mask = Image.new('L', (size, size))
ImageDraw.Draw(mask).rounded_rectangle((66, 66, 958, 958), radius=202, fill=255)
image = Image.new('RGBA', (size, size))
gradient = Image.new('RGBA', (size, size))
pixels = gradient.load()
for y in range(size):
    for x in range(size):
        t = min(1, max(0, (x + 1.25 * y) / (size * 2.25)))
        pixels[x, y] = (int(145 - t * 59), int(116 - t * 53), int(238 - t * 51), 255)
shadow = Image.new('RGBA', (size, size))
shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(20)))
shadow = Image.eval(shadow, lambda p: p // 3)
image.alpha_composite(shadow, (0, 12))
image.paste(gradient, (0, 0), mask)
draw = ImageDraw.Draw(image)
color = (255, 255, 255, 250)
for left, right, bottom, width in [(260, 764, 775, 55), (401, 623, 634, 55)]:
    radius = (right - left) / 2
    cy = bottom - radius
    points = [(left, 289), (left, cy)]
    points += [(int((left + right) / 2 + radius * math.cos(math.pi - i * math.pi / 100)), int(cy + radius * math.sin(math.pi - i * math.pi / 100))) for i in range(101)]
    points += [(right, 289)]
    draw.line(points, fill=color, width=width, joint='curve')
    for x in (left, right):
        draw.ellipse((x-width/2, 289-width/2, x+width/2, 289+width/2), fill=color)
for x1, x2 in [(209, 451), (573, 815)]:
    draw.line((x1, 268, x2, 268), fill=color, width=55)
    for x in (x1, x2): draw.ellipse((x-27, 241, x+27, 295), fill=color)
image.save(root / 'assets/icon.png')
image.save(root / 'assets/icon.icns', format='ICNS')
