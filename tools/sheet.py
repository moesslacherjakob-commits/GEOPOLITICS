import sys, glob
from PIL import Image, ImageDraw
files=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).convert('RGB').resize((432,768)) for f in files]
cols=4; rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(cols*440,rows*800),(40,40,40)); d=ImageDraw.Draw(S)
for i,(im,f) in enumerate(zip(ims,files)):
    x,y=(i%cols)*440+4,(i//cols)*800+4; S.paste(im,(x,y)); d.text((x+6,y+772),f.split('still_')[-1],fill=(255,255,0))
S.save(out)
