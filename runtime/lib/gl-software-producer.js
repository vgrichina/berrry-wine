// Configure the software GL producer on the instance that executes the guest.
// The render owner's reply mailbox is applied only after the lifecycle RPC
// finishes; invoking these exports on a main-thread instance changes nothing.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.GLSoftwareProducer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class Producer {
    constructor(getExports){
      this.getExports=getExports;
      // [software enabled, drawable width, drawable height, bitmap handle]
      this.config=new Int32Array(new SharedArrayBuffer(16));
      this.lastBitmap=0;this.lastWidth=0;this.lastHeight=0;
    }
    configure(config=this.config){
      const e=this.getExports(),enabled=config[0]?1:0;
      if(!enabled){if(e.gl_sw_enabled?.())e.gl_sw_set_enabled(0);return;}
      const width=config[1]|0,height=config[2]|0,bitmap=config[3]>>>0;
      if(width<1||height<1||width>4096||height>4096)throw new RangeError('invalid software GL drawable dimensions');
      if(typeof e.gl_sw_set_enabled!=='function')throw new Error('software GL producer exports missing');
      if(!e.gl_sw_enabled())e.gl_sw_set_enabled(1);
      if(bitmap){
        if(e.gl_sw_bitmap()!==bitmap||this.lastBitmap!==bitmap||this.lastWidth!==width||this.lastHeight!==height){
          if(!e.gl_sw_bind_bitmap(bitmap))throw new Error('software GL bitmap binding failed');
        }
      }else if(e.gl_sw_bitmap())e.gl_sw_unbind_bitmap();
      e.gl_sw_set_default_size(width,height);
      this.lastBitmap=bitmap;this.lastWidth=width;this.lastHeight=height;
    }
  }
  return {Producer};
});
