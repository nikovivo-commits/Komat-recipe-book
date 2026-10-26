"""Download the generated illustrations listed in tools/photo-sources.json, crop and shrink
them, and save them under assets/photos/art/parts. Run once by
.github/workflows/fetch-photos.yml on GitHub's machines."""
import io, json, os, sys, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = json.load(open(os.path.join(ROOT, 'tools', 'photo-sources.json')))
saved = failed = 0
for name, url in src['parts'].items():
    out = os.path.join(ROOT, 'assets', 'photos', 'art', 'parts', name + '.jpg')
    if os.path.exists(out):
        continue
    try:
        im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert('RGB')
        w, h = 800, 600
        if im.width / im.height > w / h:
            nw = int(im.height * w / h); x = (im.width - nw) // 2; im = im.crop((x, 0, x + nw, im.height))
        else:
            nh = int(im.width * h / w); y = (im.height - nh) // 2; im = im.crop((0, y, im.width, y + nh))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.resize((w, h), Image.LANCZOS).save(out, 'JPEG', quality=80, optimize=True, progressive=True)
        saved += 1
    except Exception as e:
        failed += 1
        print('failed', name, e)
print('saved', saved, 'failed', failed)
sys.exit(1 if failed else 0)
