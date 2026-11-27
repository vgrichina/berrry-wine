/* cpurun: run a command and report its CPU time (user+sys, all threads,
 * microsecond resolution) from wait4's rusage. Used by tools/wat-microbench/
 * run.js, which builds it with `cc -O2 -o cpurun cpurun.c` on first use.
 *
 *   cpurun <cmd> [args...]
 *
 * The child's stdout/stderr pass through untouched; one line
 *   CPURUN <user_us> <sys_us> <exit_status>
 * is appended to stderr after the child exits. /usr/bin/time -p only gives
 * 10 ms, which is several percent of a 0.3 s measurement. */
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: cpurun cmd [args...]\n");
    return 2;
  }
  pid_t pid = fork();
  if (pid < 0) { perror("fork"); return 2; }
  if (pid == 0) {
    execvp(argv[1], argv + 1);
    perror("execvp");
    _exit(127);
  }
  int status = 0;
  struct rusage ru;
  if (wait4(pid, &status, 0, &ru) < 0) { perror("wait4"); return 2; }
  long long u = (long long)ru.ru_utime.tv_sec * 1000000 + ru.ru_utime.tv_usec;
  long long s = (long long)ru.ru_stime.tv_sec * 1000000 + ru.ru_stime.tv_usec;
  int code = WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
  fprintf(stderr, "CPURUN %lld %lld %d\n", u, s, code);
  return code;
}
