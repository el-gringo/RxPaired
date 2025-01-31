FROM oven/bun

WORKDIR /app
COPY . /app
RUN bun install

ENTRYPOINT [ "bun", "run", "./rx-paired.ts" ]
