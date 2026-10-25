"""Contact sheet of QA stills: python3 tools/sheet.py <out.png> <still_*.png ...>
Portrait stills (Shorts) -> 4 columns of 432x768; landscape stills (long-form) -> 3 columns of 640x360."""
import sys
from PIL import Image, ImageDraw
files = sys.argv[2:]; out = sys.argv[1]
first = Image.open(files[0]); land = first.width > first.height
tw, th, cols = (640, 360, 3) if land else (432, 768, 4)
ims = [Image.open(f).convert('RGB').resize((tw, th)) for f in files]
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * (tw + 8), rows * (th + 32)), (40, 40, 40)); d = ImageDraw.Draw(S)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * (tw + 8) + 4, (i // cols) * (th + 32) + 4; S.paste(im, (x, y)); d.text((x + 6, y + th + 6), f.split('still_')[-1], fill=(255, 255, 0))
S.save(out)
