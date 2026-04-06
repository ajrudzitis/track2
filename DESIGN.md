# Track 2 Design Document

## Background and motivation

I have always loved trains. And not just the trains, but the systems and constraints under which they operate. As a
child, I loved playing with Brio trains. However, my favorite part was always build tracks and imagining the networks
that could grow. Thus, I have always been fascinated by urban subway systems, and the management that underpins them. 

Therefore, I am embarking on a quest to create piece of simulation software, where I can create and manage networks of
stations, trains, and the tracks and switches which link them. The project may start simple, with a single urban subway
line, but should be able to grow in complexity to support multiple lines, which may share tracks and stations. 

My goal with this project is to allow me the joy of building and operating these systems virtually. For now a TUI in a
terminal, perhaps expanding to other interfaces in the future. The project should not burden the designer with the
complexities of precisely laying out each element on the screen, but should allow the user to express the network and
then sit back and enjoy watching the fruits of their effort. 

This project will be called "Track2". 

## Aesthetic choices

The goal of this project is to create a view of a subway or metro system the way a control room operator would see it. 

The view SHOULD be logical rather than an a perfect reflection of reality. Therefore, elements are not expected to be to
scale. 

The thickest lines SHOULD be used to represent tracks. Text elements MAY be gray, white, or against inverse colored
backgrounds, depending on importance. Suggestions will be made for each sections before. 

Supporting scrolling within the UI is preferable to an overcrowded screen. 

### Inspirational images
- https://www.reddit.com/media?url=https%3A%2F%2Fexternal-preview.redd.it%2Fan-inside-look-at-the-nyc-subways-archaic-signal-system-v0-LsIqZaoIQLH_tsnlEXUFUHrfBJJdMrI3lSMD2hOwnVo.jpg%3Fauto%3Dwebp%26s%3D6099a7d378a75b10bc8e5d1b5190475b4c142b92
- https://www.iridetheharlemline.com/resizer.php/controlroom4.jpg?width=553&height=350&image=http://www.iridetheharlemline.com/wp-includes/images/upload_images/controlroom4.jpg
- https://www.nydailynews.com/wp-content/uploads/migration/2019/10/07/OZBGANE4LFE35KMM3HHMDK7RXE.jpg
- https://oyster.ignimgs.com/mediawiki/apis.ign.com/re3-remake/b/b4/Subway-solution.jpg?width=396&format=jpg&auto=webp&quality=80
- https://media.cnn.com/api/v1/images/stellar/prod/150116164504-mtr-occ-06.jpg?q=w_3000,h_1688,x_0,y_0,c_fill/h_447

## Technology

The implementation SHALL be cleanly separated into a view and a controller. 

The initial interface SHALL be a terminal/TUI.

Typescript MUST BE used in the initial implementation. 

External dependencies, aside from Node and Typescript, SHOULD NOT be used. 

## Guidance

The agent MUST create and update the README.md file after each task.

The agent MUST create an AGENT.md file with information useful to future agents adding features. It SHOULD include
information about the development methodology. 

The agent MUST create a git commit after completing each task and verifying success of the task. A task includes
implementing a new feature, updating a document, or fixing a bug. 

The agent MUST capture the initial implementation plan in a TODO.md. 

The agent MUST update the TODO.md file as the plan is modified and as tasks are completed. 

Development SHOULD be done by adding features in a logical order. Each element described below SHOULD be implemented one
at a time, though not necessarily in the order presented. 

After implementing an element, the agent MUST create a map which demonstrates this element. The agent SHOULD avoid
updating previous maps unless required. 

The agent MUST confirm the UX of each element with the developer before implementing, and allow the developer to test it
before considering the task complete. 

Achieving the vision of the author takes precedence over avoiding major rewrites. Previous assumptions SHOULD be
revisited if adding a few feature is overly complicated.

## Basic elements

### Track

The most basic element is a track. It represents a single pair of rails. This is the medium over which trains traverse. 

The track should be illustrated with a thick line. 

━━━━━━━━

Horizontally, straight pieces are preferable in the layout. Avoid adding other elements such as stations or switches
(defined later) on non horizontally-straight segments. Diagonal tracks may be required to support more complex layouts in
the future. Vertical lines should be avoided unless absolutely necessary. 

At least two character widths SHOULD be allowed between a track and its UI elements from other adjacent tracks and their
associated UI elements. 

Trains cannot pass each other on a track. 

### Trains

Trains are a single unit which traverses tracks.

Trains are composed of a block of text on an inverted pallet (black text over a colored background). 

A train is illustrated with an ID, an arrow indicating the current direction of travel, and a background color
identifying the route/line (to be specified later in this document).

A train on a track should look like this (except with an inverted background):

━━━◂T45868━━━

During operation, a train SHOULD be shown to be moving along a track. 


### Signals

A signal instructs a train to stop or proceed. A signal MAY also indicate additional information, as what direction a
switch is set. 

A single signal is visible from only one direction. Signals therefore typically come installed in pairs. 

The following is a typical illustration of signals along a track. Note how the signal visible to eastbound trains is
suffixed with a E and the signal for westbound trains W. 

     23E  23W 
      X    X
━━━━━━━━━━━━━━━━

In the above illustration `X` represents a symbol indicating how the signal is set. 

The program SHOULD allow the map file to select a signal style according to preference. 

The default signal should be a green or red circle, corresponding to start or stop. In the case a direction is indicated
(in the case of a switch) a colored arrow may be used. 

The program MAY support other styles or color patterns. 

The program MUST prevent signals from being set in a way which would cause conflicts. For example, in the illustrated
example, only one of the signals should allow a train to pass. 


### Segments

Tracks are logically divided into segments. A segment may be a plain track, or other elements such as switches or
stations, to be defined later. 

A segment MUST be allowed to contain a single train at a time (to prevent collisions). 

Segments are labeled. However, the segment label is primarily for debugging and SHOULD use a more muted color text so
as not to distract from more critical UX elements. 


An example segment
      
    S123
━━━━━━━━━━━━━━━━

The start and end of a segment MAY be illustrated but is not required in cases it may be implied by the presence of
other elements such as stations, signals, or switches. 

Signals MUST be used to guard segments against entry by multiple trains. 

### Platforms

A platform is a location where a train loads or unloads.

A platform is a special case of segment. It SHOULD be guarded by signals to prevent multiple trains from occupying the
same platform. 

A platform should be illustrated the same as a segment. However, the segment label, rather than being muted will be
highlighted black text on a color background. The text should be an abbreviation of the station name, suffixed with a
platform direction or number in the case the station has multiple platforms. 

By default, a train SHOULD pause at the platform to transfer passengers. 

Future versions MAY allow defining express routes in which case trains bypass certain stations. 

### Track groups

Tracks MAY appear in pairs. This is the default case. In the case of pairing, each track has a default direction of
travel.

Each track, however, has its own signals, platforms, etc. 

By default, signals should be set to default direction of travel. 

Future versions MAY allow track groups which have more than 2 tracks, allowing bypass for express trains in a middle
track or middle pair of tracks. 

A track group MAY be referred to as a line. Future versions may allow a line to have more tracks for certain segments.

### Station

A station is the name for a collective group of platforms in a track group. In the case of a single track configuration
for a line, a station has a single platform. In the case of track groups of 2 or more tracks, there SHOULD be at least
two platforms. However, some bypass tracks MAY not have platforms. 


### Switches

Switches are a special type of segment that allow trains to move between tracks in a track group or to branch onto new
lines. 

A switch MUST be guarded by a signal from all approach directions. 

#### Branches

The simplest type of switch allows branching.

In the following example a train may travel from (a) to (c) or (a) to (b), depending on how the switch is set. However,
a train can only travel from (c) to (a) or (b) to (a) if the switch is set correctly. If the switch is not set properly,
the train MUST be guarded from entering the segment. 

A train CANNOT travel from (b) to (c) or vice versa. 

Signals are located at points (e), (f), and (g). However, only (e) is required to show the direction the switch is set. 

Standard rules about multiple trains in a segment still apply. 

An arrow at point (x) indicates how the switch is set. 


     e     f
 a ━━━━x━━━━━━━━━━━━━━ b 
        ╲ 
		 ╲ d
          ╲ 
           ━━━━━━━━━━━ c
            g

Branches MAY traverse other track segments. Note in the following example trains can only travel from (h) to (i) and
vice versa and cannot enter the path crossing over. However, to prevent collisions, signals at (h) and (j) guard trains
from entering this segment if a switch is set to allow a train to travel from (a) to (c) or vice versa. 


     e     f
 a ━━━━x━━━━━━━━━━━━━━ b 
        ╲ 
         ╲  d
	 j	  ╲    k
 h ━━━━━━━━━━━━━━━━━━━ i
            ╲
             ╲ 
              ╲ 
               ━━━━━━━━━━━ c
               g

#### Cross over

A switch may also allow trains to transfer between two parallel tracks. 


     e     f
 a ━━━━x━━━━━━━━━━━━━━ b 
        ╲ 
		 ╲ 
          ╲ 
 c ━━━━━━━━y━━━━━━━━━━━ d
     g        h


A train may go from (a) to (b), (a) to (d), (c) to (d), or vice versa for any of the pairs. A train cannot travel from
(a) to (c) or (b) to (d) or vice versa. 

Signals at (e), (f), (g), and (h) guard entry to the switch. Additionally signals at (e) and (h) should indicate the
direction the switch is set. Travel between (a) and (b) is allowed to take place at the same time as (c) and (d), while
the cross over is not set. If the switch is set for cross over, other use of the switch is blocked. 

Symbols at (x) and (y) should indicate how the switch is set.

As with a branch switch, a cross over MAY cross over other lines.

#### Double cross over

A cross over may also be combined to allow cross over in multiple directions.

     e       f
 a ━━━━x━━━z━━━━━━━━━━ b 
        ╲ /
		 X 
        / ╲ 
 c ━━━━w━━━━y━━━━━━━━━ d
     g        h

In this case, a train may additional travel from (c) to (b) or vice versa. All signals indicate how the adjacent switch
is set. If either cross over is used, that setting has exclusive use of the overall segment. 

### Terminal behavior

The terminal segment of a line is expected to have special behavior. 


     A 
 |━━━━━━━━━━━━━━━━━━x━━━z━━━━━━━━━ c
                     ╲ /
		              X 
                     / ╲ 
 |━━━━━━━━━━━━━━━━━━w━━━y━━━━━━━━━ d
     B
	 
	 
A train approaching from (c) (assuming (c) is the inbound track), by default should cross over (passing through (z) and
(w)) and terminate the route (B). However, if (A) is occupied by a train on a layover, a train approaching from (c) may
terminate at platform (A). On beginning the next run, the train is expected to cross over using (x) and (y) to take the
outbound track (d). 

Signals are omitted from this diagram but are expected to behave as described above. 

If both platforms (A) and (B) are occupied, a train inbound from (c) MUST be held at the signal ahead of (z) (not
illustrated) until one of the platforms is clear and a path through the switch is clear.  

A line may also be terminated by a single platform, in such a manner.

      
                        z━━━━━━ c
                       /
		              / 
                     / 
 |━━━━━━━━━━━━━━━━━━w━━━━━━━━━━━━ d
     B

In this case, a train approach from (c) must utilize the switch to enter platform (B). If (B) is occupied, a signal must
prevent the train from entering the switching segment ahead of the station. All other rules about branch switches still
apply. 


### File format

The file format used to describe tracks and train routes SHOULD be inspired by the format by mermaid diagrams. 

#### Layout

The layout portion of the diagram must use a mermaid like format to describe segments, platforms, and switches. 

The actual layout SHOULD be deterministic. However, the file SHOULD focus on the logical relationship between
elements. The layout of elements on the screen should be the focus of the program. 

#### Routes

The file format SHOULD specify routes as a sequence of platforms. 

The file format MAY allow additional hints on segments to use for the route, in the case of ambiguity. 

The file format SHOULD specify the number of trains on each route. 

The file format MAY include other information as needed to support the functionality described above and provide a good
UX.

During execution, switches SHOULD be set for trains automatically. 

The file format SHOULD also specify a default time for trains to pause at the station. 

### Special Features

Special features for future incorporation.

- The user MAY manually override switches. However, the system MUST prevent switches from being set in a way that would
  introduce a conflict.
- The user MAY view the arrival board for any station. 
