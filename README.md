# What is the Datapool Manager?
The datapool manager is a tool-agnostic utility for handling test data for load testing. It was based off the functionality provided by JMeter's Simple Table Server plugin, but built as a standalone program. This means you can have your test data hosted and running 24/7 and utilised by different load testing tools.

## Key functionality
The Datapool Manager (DPM) provides:
- Sequential and random access of records
- Creating test data on the fly
- Consumable data (records that can only be used once)

It is built to be high performing and reliable.

# Installation

## Running natively
Datapool Manager is a Node.js app so to run it from a laptop/server you will need to install Node.js first. Download and install the appropriate version from https://nodejs.org/en/download/

Once you have Node.js installed clone the repo, for example using HTTPS:
```
git clone https://github.com/the-kiwi-sre/datapool-manager.git
```

DPM requires a configuration file called `config.json` in the root folder of the project, which is not tracked. Take a copy of `example-config.json` and rename it to `config.json` and make any changes you would like.

Navigate into the datapool-manager folder and install the required dependencies:
```
cd ./datapool-manager
npm install
```

Then to run DPM:
```
npm start
```

*TODO: Write how to add test data to the raw-csv folder.* 

## Docker

## Kubernetes

# Usage