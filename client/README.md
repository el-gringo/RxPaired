# RxPaired-client

This directory is the home of the `RxPaired-client`, the script of RxPaired
that will run on the device.

This script mostly re-implement the console logging functions (`console.log`,
`console.warn` etc.) to send logs through a WebSocket to the `RxPaired-server`
(see `../server` directory), does the same thing to network-related APIs, and
optionally evaluate code sent from the `RxPaired-inspector` and send back the
result.
