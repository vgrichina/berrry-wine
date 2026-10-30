#
# Polyhedron representing tree 
#
# Syntax: tux_tree_poly <vertex list> <polygon list>
#     where each polygon in the polygon list is a list of indices into
#     the vertex list.
#
set tree_poly {{              
    { 0 0 0 }
    { 0.0 0.15  0.5 }
    { 0.5 0.15  0.0 }
    { 0.0 0.15 -0.5 }
    {-0.5 0.15  0.0 }
    { 0 1 0 }
} {
    { 0 1 4 }
    { 0 2 1 }
    { 0 3 2 }
    { 0 4 3 }
    { 1 5 4 }
    { 2 5 1 }
    { 3 5 2 }
    { 4 5 3 }
}}

