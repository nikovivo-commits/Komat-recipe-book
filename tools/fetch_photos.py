"""Download the generated product photos and recipe illustrations listed in
tools/photo-sources.json, shrink them and save them under assets/photos/.
Run by .github/workflows/fetch-photos.yml on GitHub's machines."""
import io, json, os, sys, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = json.load(open(os.path.join(ROOT, 'tools', 'photo-sources.json')))
jobs = [('produce', k, v, 480, 480) for k, v in src['produce'].items()] + [('art', k, v, 800, 600) for k, v in src['art'].items()]
saved = failed = 0
for folder, name, url, w, h in jobs:
    out = os.path.join(ROOT, 'assets', 'photos', folder, name + '.jpg')
    if os.path.exists(out):
        continue
    try:
        im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert('RGB')
        # crop to the target shape from the middle, then shrink
        r = w / h
        if im.width / im.height > r:
            nw = int(im.height * r); x = (im.width - nw) // 2; im = im.crop((x, 0, x + nw, im.height))
        else:
            nh = int(im.width / r); y = (im.height - nh) // 2; im = im.crop((0, y, im.width, y + nh))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.resize((w, h), Image.LANCZOS).save(out, 'JPEG', quality=80, optimize=True, progressive=True)
        saved += 1
    except Exception as e:
        failed += 1
        print('failed', folder, name, e)
print('saved', saved, 'failed', failed)
sys.exit(1 if failed else 0)
