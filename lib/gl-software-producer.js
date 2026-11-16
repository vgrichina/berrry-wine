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
      // [software enabled, drawable width, drawable height, bitmap handle,
      //  GPU stream v2 (1 on, 0 off)]. The page's GL bridge writes word 4
      //  (lib/gl-render-host.js) from the host's glGps option, so a Threads
      //  run lowers software GL onto the ring like a cooperative one.
      this.config=new Int32Array(new SharedArrayBuffer(20));
      this.lastBitmap=0;this.lastWidth=0;this.lastHeight=0;this.lastGps=undefined;
    }
    configure(config=this.config){
      const e=this.getExports(),enabled=config[0]?1:0;
      if(!enabled){if(e.gl_sw_enabled?.())e.gl_sw_set_enabled(0);return;}
      const width=config[1]|0,height=config[2]|0,bitmap=config[3]>>>0;
      if(width<1||height<1||width>4096||height>4096)throw new RangeError('invalid software GL drawable dimensions');
      if(typeof e.gl_sw_set_enabled!=='function')throw new Error('software GL producer exports missing');
      if(!e.gl_sw_enabled())e.gl_sw_set_enabled(1);
      // src/09a8gt-gl-gps.wat on this instance: its ring kicks go through
      // guest-rpc's gpu_stream_kick to the render Worker (api 3). A config
      // without word 4 (an older caller), or -1 there, leaves the arm as it is.
      if(config.length>4&&config[4]>=0&&typeof e.gl_gps_enable==='function'){
        const gps=config[4]?1:0;
        if(this.lastGps!==gps){e.gl_gps_enable(gps);this.lastGps=gps;}
      }
      // Save the old drawable before changing a bitmap binding. Window keys
      // arrive in the native wglMakeCurrent record; bitmap keys are in this
      // mailbox and also serve legacy native-only clients of this producer.
      if(typeof e.gl_sw_bind_drawable==='function'){
        if(bitmap)e.gl_sw_bind_drawable((bitmap|0x80000000)>>>0);
        else if(e.gl_sw_bitmap())e.gl_sw_bind_drawable(0);
        e.gl_sw_set_default_size(width,height);
        this.lastBitmap=bitmap;this.lastWidth=width;this.lastHeight=height;
        return;
      }
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
