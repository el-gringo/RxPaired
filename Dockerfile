FROM oven/bun

WORKDIR /app
COPY . /app
RUN bun install
RUN ls -lah

ENTRYPOINT [ "bun", "run", "./rx-paired.ts" ]
