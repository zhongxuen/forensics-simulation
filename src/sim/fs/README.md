# src/sim/fs

The virtual filesystem: an immutable tree of files, folders, and symlinks with owners, groups, and modes. Path resolution follows symlinks (up to a depth limit) and never climbs above `/`. Every operation checks POSIX permissions against the session's user and returns a new tree or a typed error; untouched branches are shared. `builder.ts` turns a declarative spec from mission content into a tree.

Never import here: Node's `fs` or any real filesystem access. Nothing here reads or writes the user's disk.
