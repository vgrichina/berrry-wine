# midiStreamStop integration blocked on current main

Base: a5bc63b1f393aa1fd28b82b8408643a7b30e25e9. Accepted implementation: 2def2064ac4461974e665ea7c47d10cc2073509c; independent acceptance: 820a1eef5e1cbf0e6fac7b4b205841768ebe6d55.

The accepted audio delta fails its first patch hunk on this base. Current main has moved stream queues, registrations and clocks to host devices and already defines handle_midiStreamStop through host_midi_stream_control. The accepted implementation instead requires module-global midi_stream_due_ms, midi_stream_event_pending and midi_stream_paused_at, all absent on current main. Its focused and independent fixtures extract these historical functions and globals and cannot validate the newer host-owned design unchanged.

The current API has 4595 rows and already contains midiStreamStop. Appending another entry or replacing generated tables would violate integration requirements. No production code, API rows or generated tables were changed. No handler acceptance suite, mutant check, generator freshness check, full VM build, actual x86 callback, guest or gameplay execution was performed. A lightweight Node startup check passed under the prescribed supervisor. A targeted source/API assertion confirmed this conflict.

Stop condition: real architectural conflict; no main publication. Coordinator must assign reconciliation of the accepted behavior with the host-owned multi-stream implementation, followed by acceptance at that production boundary. Historical independent acceptance is not acceptance of current main.
