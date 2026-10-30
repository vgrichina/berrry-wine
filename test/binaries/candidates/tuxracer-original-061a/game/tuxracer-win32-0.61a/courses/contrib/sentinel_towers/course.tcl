#
# Course configuration
#
tux_course_name "Sentinel Towers"
tux_course_author "Steve, Mathieu, Jerome (Flat 6.3, Leeds 2000)"
# Jerome aka Agt the Walker: <jzago@ifhamy.insa-lyon.fr>
tux_course_dim 80 900          ;# width, length of course in m
tux_start_pt 44 4              ;# start position, measured from left rear corner
tux_angle 22.5                 ;# angle of course
tux_elev_scale 15.0            ;# amount by which to scale elevation data
tux_base_height_value 0        ;# greyscale value corresponding to height
                               ;#     offset of 0 (integer from 0 - 255)
tux_elev elev.rgb              ;# bitmap specifying course elevations
tux_terrain terrain.rgb        ;# bitmap specifying terrains type

tux_course_init
