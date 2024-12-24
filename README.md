# OriSim3D
Origami simulation

Test and Coverage
```bash
deno test --coverage=cov_profile  test/*.test.ts
deno coverage cov_profile
```

Serve index.html
```bash
deno run --allow-net --allow-read jsr:@std/http/file-server
```
and open
http://localhost:8000

