
#
# Procedure to get course name, author, and par time from course.tcl file.
#
proc get_course_info { } {
    if [catch {open course.tcl r} fileId] {
	puts stderr "Couldn't open course.tcl in [pwd]"
	return {}
    }

    set name ""
    set author ""
    set par_time ""

    while {[gets $fileId line] >= 0} {
	regexp {tux_course_name *([^;]*)} $line match name
	regexp {tux_course_author *([^;]*)} $line match author
	regexp {tux_par_time *([^;]*)} $line match par_time

	if { $author != "" && $name != "" && $par_time != "" } {
	    break;
	}
    }

    if { $author == "" } {
	set author "Unknown"
    }

    if { $name == "" } {
	set name "Unknown"
    }

    if { $par_time == "" } {
        set par_time 120.0
    } 

    # Remove quotes around strings, etc.; e.g. "Jasmin Patry" -> Jasmin Patry
    eval "set name $name"
    eval "set author $author"
    eval "set par_time $par_time"

    return [list $name $author $par_time];
}

set cwd [pwd]
tux_goto_data_dir

tux_load_texture noicon textures/noicon.rgb

cd courses

tux_load_texture no_preview common/nopreview.rgb
tux_bind_texture no_preview no_preview

#
# Bind preview textures if they exist
#
foreach course [glob -nocomplain *] {
    if { $course == "common" || $course == "contrib" } {
	continue;
    }
    if [file exists "$course/preview.rgb"] {
	tux_load_texture $course "$course/preview.rgb"
	tux_bind_texture $course $course
    }
}

cd contrib;

foreach course [glob -nocomplain *] {
    if [file exists "$course/preview.rgb"] {
	tux_load_texture "contrib/$course" "$course/preview.rgb"
	tux_bind_texture "contrib/$course" "contrib/$course"
    }
}

cd ..

#
# Build list of contributed courses in contrib
#
cd contrib
set contrib_course_list {}
foreach course [glob -nocomplain *] {
    if { $course == "CVS" } {
	continue;
    }

    if [catch {cd $course}] {
	puts stderr "Couldn't change directory to $course"
	continue;
    }

    set course_info [get_course_info]

    cd ..

    set description "Contributed by: [lindex $course_info 1]"
    
    lappend contrib_course_list \
	    [list -course "contrib/$course" -name [lindex $course_info 0] \
	    -description $description -par_time [lindex $course_info 2] ] 
}
cd ..

tux_open_courses [concat \
    { \
	{ \
	    -course frozen_river -name "Frozen River" \
		    -description "Keep your speed down to collect herring!" \
                    -par_time 80.0 \
	} \
	{ \
	    -course path_of_daggers -name "Path of Daggers" \
		    -description "Big spikes may prove to be the least of your worries on this course.  Muliple paths allow you to take low or high roads, each with their own challenges." \
                    -par_time 70.0 \
	} \
	{ \
	    -course bunny_hill -name "Bunny Hill" \
		    -description "Use clever turning to conquer the Bunny Hill." \
                    -par_time 40.0 \
	} \
	{ \
	    -course twisty_slope -name "Twisty Slope" \
		    -description "Tight twists make grabbing herring difficult.  Hard turns will lead you to victory." \
                    -par_time 40.0 \
	} \
	{ \
	    -course bumpy_ride -name "Bumpy Ride" \
		    -description "This hill has a series of ramps tackle.  Make sure to line yourself up before getting airborne." \
                    -par_time 40.0 \
	} \
    } \
    $contrib_course_list \
]

tux_load_texture herring_run_icon common/herringrunicon.rgb 0
tux_load_texture cup_icon common/cupicon.rgb 0

tux_events {
    { 
	-name "Herring Run" -icon herring_run_icon -cups {
	    { 
		-name "Canadian Cup" -icon cup_icon -races {
		    {
			-course bunny_hill \
				-name "Bunny Hill" \
				-description "Use clever turning to conquer the Bunny Hill." \
				-herring { 23 23 23 23 } \
				-time { 37 35 32 30 } \
				-score { 0 0 0 0 } \
				-mirrored no -conditions sunny \
				-windy no -snowing no
		    }
		    {
			-course twisty_slope \
				-name "Twisty Slope" \
				-description "Tight twists make grabbing herring difficult.  Hard turns will lead you to victory." \
				-herring { 24 24 24 24 } \
				-time { 43 40 34 31.5 } \
				-score { 0 0 0 0 } \
				-mirrored no -conditions sunny \
				-windy no -snowing no
		    }
		    {
			-course bumpy_ride \
				-name "Bumpy Ride" \
				-description "This hill has a series of ramps tackle.  Make sure to line yourself up before getting airborne." \
				-herring { 18 18 18 18 } \
				-time { 35 30 28 27 } \
				-score { 0 0 0 0 } \
				-mirrored no -conditions sunny \
				-windy no -snowing no
		    }
		}
	    }
	}
    }
}
    

cd $cwd

