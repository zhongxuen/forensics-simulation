/**
 * The Linux command set (md-files/05-terminal-module.md, "Command set (v1)"). Each command is one
 * file and one line here; tools/index.ts registers them alongside the simulated security tools.
 */
import type { Tool } from "../types";
import { cat } from "./cat";
import { cd } from "./cd";
import { chmod } from "./chmod";
import { chown } from "./chown";
import { clear } from "./clear";
import { cp } from "./cp";
import { cut } from "./cut";
import { date } from "./date";
import { echo } from "./echo";
import { env } from "./env";
import { exit } from "./exit";
import { file } from "./file";
import { grep } from "./grep";
import { head } from "./head";
import { help } from "./help";
import { history } from "./history";
import { hostname } from "./hostname";
import { id } from "./id";
import { ifconfig } from "./ifconfig";
import { less } from "./less";
import { ls } from "./ls";
import { man } from "./man";
import { mkdir } from "./mkdir";
import { mv } from "./mv";
import { ping } from "./ping";
import { ps } from "./ps";
import { pwd } from "./pwd";
import { rm } from "./rm";
import { sed } from "./sed";
import { sort } from "./sort";
import { stat } from "./stat";
import { sudo } from "./sudo";
import { tail } from "./tail";
import { touch } from "./touch";
import { tree } from "./tree";
import { uname } from "./uname";
import { uniq } from "./uniq";
import { wc } from "./wc";
import { whoami } from "./whoami";

export const LINUX_COMMANDS: readonly Tool[] = [
  // Navigation
  pwd,
  ls,
  cd,
  tree,
  // Files
  cat,
  less,
  head,
  tail,
  touch,
  mkdir,
  rm,
  cp,
  mv,
  stat,
  file,
  // Text
  grep,
  wc,
  sort,
  uniq,
  cut,
  sed,
  echo,
  // System
  whoami,
  id,
  ps,
  uname,
  env,
  history,
  date,
  // Permissions
  chmod,
  chown,
  sudo,
  // Network (netscan and webprobe are simulated tools, registered in tools/index.ts)
  ping,
  hostname,
  ifconfig,
  // Help
  man,
  help,
  clear,
  exit,
];
