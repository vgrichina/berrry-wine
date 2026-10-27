PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba'
for name in ['tools/build.sh','tools/toyvm/bundle-browser.js']:
 b=git('inspect-'+pathlib.Path(name).name,['-C',str(H/'repo'),'show',PIN+':'+name]);(O/('canonical-'+pathlib.Path(name).name)).write_text(b+'\n')
print('exact canonical source retained')
