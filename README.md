# Cockpit-based nBox UI

## Prerequisites

- cockpit
- cockpit-navigator
- npm (development only)

 
```sh
apt install cockpit cockpit-navigator npm
```

- ntop suite (ntopng, nprobe, n2disk) from https://packages.ntop.org

## Development

### Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev -- --host
```

### Compile and Minify

```sh
npm run build
```

### Compile and Install in Cockpit

```sh
sudo make build-install
```

## Production

### Install (pre-compiled dist) in Cockpit

```sh
sudo make install
```
