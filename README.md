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

To check whether it is running open a browser and navigate to http://localhost:9192/DPM/STATUS (provided you kept the default port of 9192).

*TODO: Write how to add test data to the raw-csv folder.* 

## Docker

## Kubernetes

# Usage
The basic process is:
- Source or create the datapools you want in CSV format and put them in the /raw-csv folder of this project.
- Start the DPM with **npm start**
- You can now call the APIs below from your load testing tool to retrieve, modify, or add test data

# API reference
The DPM has several APIs that you can call. This is a reference of each one and the arguments you can supply.

## STATUS
Calling /dpm/STATUS returns a list of all the currently loaded datapools (CSV files) along with how many records exist for each. It's a good way to check that DPM is running, as well as to verify that there is sufficient test data for your testing needs.

Usage:
```
GET http://localhost:9192/dpm/STATUS
```

Example response:
```json
{"message":{"newdata.csv":3,"testdata.csv":3}}
```

In this response we can see there are two datapools: **newdata.csv** with three records and **testdata.csv** with three records.

## RELOAD
Loads all of the CSV files in your /raw-csv folder into memory. Overwrites any changes you have made to datapools in memory which have not yet been saved back to disk. Returns a UTC timestamp for when the reload was completed.

Example usage:
```
GET http://localhost:9192/DPM/RELOAD
```

Example response:
```json
{"reloaded_time":1763079773553}
```

## READ
The READ operation reads a row of data from a particular datapool. This allows reading sequentially, randomly, and you can optionally choose to delete the record after reading it (consumable data).

Example usage:
```
GET http://localhost:9192/DPM/READ?FILENAME=newdata.csv&READ_MODE=RANDOM&KEEP=true
```
Query string parameters:
|Paramater|Required?|Description|
|-|-|-|
|FILENAME|Yes|Name of the file (datapool) to read from.|
|READ_MODE|No|Can be FIRST to read sequentially from top to bottom or RANDOM to pick a random record. Set to FIRST by default.|
|KEEP|No|Keep the record after reading it? TRUE keeps the record and FALSE deletes it after reading. Set to TRUE by default. **CASE SENSITIVE** (you must use uppercase TRUE or FALSE orherwise it will default to TRUE)|

Example response:
```json
{"record":"row2"}
```

## CREATE
The CREATE operation creates a new datapool file (CSV) on disk and loads it into memory. If the file already exists, nothing happens. This provides a way to dynamically create datapools on the fly.

Example usage:
```
POST http://localhost:9192/DPM/CREATE

FILENAME=created_file.csv
```

Example response:
```json
{"line_added":"Created + created-file.csv"}
```

## ADD
Adds a row of data to an existing datapool.

Example usage:
```
POST http://localhost:9192/DPM/ADD

ADD_MODE=LAST
FILENAME=create_file.csv
LINE=a,row,of,data
```

Form post parameters:
|Paramater|Required?|Description|
|-|-|-|
|FILENAME|Yes|Name of the file (datapool) to write to.|
|ADD_MODE|No|Can be FIRST to add a row of data at the top of the file or LAST to add it after the last row. Default is LAST. Case sensitive (must be uppercase)|
|LINE|Yes|The row of data to write|

Example response:
```json
{"line_added":"a,row,of,data"}
```