tux_course_light 0 -on -position { 1 1 0 0 } -diffuse { 1.0 0.9 1.0 1 } \
     -specular { 0.0 0.0 0.0 1 } -ambient { 0.45 0.53 0.75 1.0 }

tux_course_light 1 -on -position { 1 1 2 0 } -specular { 0.8 0.8 0.8 1 } 

tux_fog -on -mode linear -density 0.005 -colour { 1.0 1.0 1.0 1 } -start 0 \
    -end [tux_get_param forward_clip_distance]
  
tux_load_texture envmap ../common/envmap.rgb 0
tux_bind_texture terrain_envmap envmap

tux_particle_colour { 0.85 0.9 1.0 1.0 }

tux_load_texture sky_front ../common/sunnyfront.rgb 0
tux_load_texture sky_right ../common/sunnyright.rgb 0
tux_load_texture sky_left ../common/sunnyleft.rgb 0
tux_load_texture sky_back ../common/sunnyback.rgb 0
tux_load_texture sky_top ../common/sunnytop.rgb 0
tux_load_texture sky_bottom ../common/sunnybottom.rgb 0

tux_bind_texture sky_front sky_front
tux_bind_texture sky_right sky_right
tux_bind_texture sky_left sky_left
tux_bind_texture sky_back sky_back
tux_bind_texture sky_top sky_top
tux_bind_texture sky_bottom sky_bottom
