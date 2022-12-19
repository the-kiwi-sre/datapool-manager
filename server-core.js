/***********************/
/** REQUIRED LIBRARIES */
/***********************/
const express = require('express'); // Import express module
const bodyParser = require('body-parser'); // Import body-parser module
const url = require('url') // Import url module
const memory_manager = require('./memory-manager.js');
const fs = require('fs');

// Dependencies for Prometheus instrumentation
const Prometheus = require('prom-client');
const { response } = require('express');
//const collectDefaultMetrics = Prometheus.collectDefaultMetrics();
const register = new Prometheus.Registry();

register.setDefaultLabels({
    app: 'datapool-manager'
})
Prometheus.collectDefaultMetrics({register})

// Custom metric to track the number of HTTP requests made to the Datapool Manager
const http_request_counter = new Prometheus.Counter({
    name: 'dpm_http_request_count',
    help: 'Count of HTTP requests made to the Datapool Manager',
    labelNames: ['method', 'route', 'statusCode'],
  });
register.registerMetric(http_request_counter);

// Custom metric so track the response time to requests made to the Datapool Manager
const http_request_duration_seconds = new Prometheus.Histogram({
    name: 'dpm_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds. Only for some routes.',
    labelNames: ['method', 'route', 'code'],
  })
register.registerMetric(http_request_duration_seconds);


// CONFIG WE NEED
/* 
    - Port to run on
    - Path to CSV files
*/

// Define our app
const app = express(); 

// Object to hold our configuration
let configuration;

// Checks to see if the --config argument is present
if ( process.argv.indexOf('--config') > -1 )
{
    const config_index = process.argv.indexOf('--config');

    if (config_index > -1) 
    {
        // Grabs the value after --name
        config_value = process.argv[config_index + 1];
    }

    console.log("INFO: Config file path: " + config_value);

    // Load the config file
    let rawdata = fs.readFileSync(config_value);
    configuration = JSON.parse(rawdata);
    
    //console.log(configuration);
}
else
{
    console.log("ERROR: You need to supply a config file (JSON)");
}

// Pre-load any files in the config file
configuration.files_to_preload.forEach(function(filename)
{
    memory_manager.Load(filename, configuration.csv_path, (err,message,filename,rows)=>{
        if(err)
        {
            console.log("Test data file " + filename + "does not exist!");
            console.log(err);            
        }
        else
        {
            console.log("INFO: Loaded " + rows + " lines from " + filename + " into memory.");
        }
    });
});

// Set the HTTP port
const port = process.env.PORT || configuration.port;

// @TOOD: Check that a CSV path has been provided in the JSON config (csv_path)

// Set the path of the CSV files
const csv_path = configuration.csv_path;

// Configure app to use body-parser for JSON (REST)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ROUTES FOR OUR API
// ==================
const router = express.Router();

// This route is called every time a request is sent to the server.
// We use it for debugging/logging 
router.use(function(req, res, next)
{
    // Start a timer for every request made
    res.locals.startEpoch = Date.now();

    // Increment the HTTP request counter for the total number of requests made
    http_request_counter.labels({method: req.method, route: '_total', statusCode: res.statusCode}).inc();
 
    // Increment the HTTP request counter for the specific path/route that was requested
    http_request_counter.labels({method: req.method, route: req.originalUrl, statusCode: res.statusCode}).inc();

    //console.log('Something is happening.');
    next();
})

// This is our default / health check route if we just called http://localhost:8080/
router.get('/', function(req, res) 
{
    res.json({ message: 'INFO: Health check succeeded!' });   
});

/* 

    Replicated STS functionality... this time we just read line by line and stored in memory as linked lists

    GET http://hostname:port/dpm/INITFILE?FILENAME=logins.csv
    (Return the number of records loaded into memory)

    GET http://hostname:port/dpm/READ?READ_MODE={FIRST, LAST, RANDOM}&KEEP={TRUE, FALSE}&FILENAME=logins.csv
    (Return the text line in a JSON object)

    POST http://hostname:port/dpm/ADD?FILENAME=dossier.csv&LINE=D0001123&ADD_MODE={FIRST, LAST}&UNIQUE={FALSE, TRUE}
    (Return success or failure)

    http://hostname:port/dpm/LENGTH?FILENAME=logins.csv

    http://hostname:port/dpm/STATUS
    (Full list of all data files loaded, how many records for each)
*/


/****************************/
/* GET RELOAD             
/****************************/
// Reloads all the files from disk
router.get('/dpm/RELOAD', function(req, res)
{
    // Before we do this, we need to clear out everything in memory
    memory_manager.ClearAll((err,message)=>{
        console.log(message);        
    });

    configuration.files_to_preload.forEach(function(filename)
    {
        memory_manager.Load(filename, configuration.csv_path, (err,message,filename,rows)=>{
            if(err)
            {
                console.log("Test data file " + filename + "does not exist!");
                console.log(err);            
            }
            else
            {
                console.log("INFO: Loaded " + rows + " lines from " + filename + " into memory.");
            }

            // Capture response time for this route
            const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
            responseTimeInSec = responseTimeInMilliseconds / 1000;

            http_request_duration_seconds
                .labels(req.method, req.route.path, res.statusCode)
                .observe(responseTimeInSec)
        });
    }); 
    
    var today = new Date();
    res.status(200).json({ reloaded_time: today.getTime() }); 
});



/****************************/
/* GET SAVE             
/****************************/
router.get('/dpm/SAVE', function(req, res)
{
    // The user must specify the 'filename' of a CSV file to create an instance from - if not throw a server error
    if (!req.query.FILENAME)
    {
        res.status(500).json({ message: 'ERROR: You must specify the "filename" parameter of the datapool to add to!' });   
    }

    let filename = req.query.FILENAME;

    memory_manager.Save(filename,csv_path,(err,filename)=>{            
        if(err)
        {
            console.log(err);
            res.status(500).json({ message: err }); 
        }
        else
        {
            res.status(200).json({ file_saved: filename }); 
        }

        // Capture response time for this route
        const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
        responseTimeInSec = responseTimeInMilliseconds / 1000;

        http_request_duration_seconds
            .labels(req.method, req.route.path, res.statusCode)
            .observe(responseTimeInSec)

        });
});


/****************************/
/* POST ADD             
/****************************/
router.post('/dpm/ADD', function(req, res)
{
    // The user must specify the 'filename' of a CSV file to create an instance from - if not throw a server error
    if (!req.body.FILENAME)
    {
        res.status(500).json({ message: 'ERROR: You must specify the "filename" parameter of the datapool to add to!' });   
    }

    let add_mode = req.body.ADD_MODE;
    let filename = req.body.FILENAME;
    let line = req.body.LINE;

    // Make sure the LINE parameter is provided
    if (!line)
    {
        res.status(500).json({ message: 'ERROR: You must specify the LINE parameter with the data to add to the file!' });   
    }
    
    // If no ADD_MODE is defined we just default to LAST
    if (!add_mode)
    {
        add_mode = "LAST";
    }

    // If the ADD_MODE is FIRST...
    if (add_mode == "FIRST")
    {
        memory_manager.AddFirst(filename,line,(err,line)=>{
                
            if(err)
            {
                console.log(err);
                res.status(500).json({ message: err }); 
            }
            else
            {
                res.status(200).json({ line_added: line }); 
            }
            });

            // Capture response time for this route
            const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
            responseTimeInSec = responseTimeInMilliseconds / 1000;

            http_request_duration_seconds
                .labels(req.method, req.route.path, res.statusCode)
                .observe(responseTimeInSec)
    }

    if (add_mode == "LAST")
    {
        memory_manager.AddLast(filename,line,(err,line)=>{
                
            if(err)
            {
                console.log(err);
                res.status(500).json({ message: err }); 
            }
            else
            {
                res.status(200).json({ line_added: line }); 
            }
            });

            // Capture response time for this route
            const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
            responseTimeInSec = responseTimeInMilliseconds / 1000;

            http_request_duration_seconds
                .labels(req.method, req.route.path, res.statusCode)
                .observe(responseTimeInSec)
    }    
});



/****************************/
/* GET READ             
/****************************/
router.get('/dpm/READ', function(req, res) 
{
    // Extract the query string parameters
    let qsp = url.parse(req.url, true).query;

    let filename = req.query.FILENAME;
    let read_mode = req.query.READ_MODE;
    let keep = req.query.KEEP;

    // If the user did not specify a filename
    if (!filename)
    {
        res.status(500).json({ message: 'ERROR: You need to specify a filename.' });   
    }

    // If the user did not specify a READ_MODE set it to FIRST...
    if (!read_mode)
    {
        console.log("WARNING: No READ_MODE defined, defaulting to FIRST...")

        read_mode = "FIRST";
    }

    // If the user did not specify KEEP set it to true...
    if (!keep)
    {
        console.log("WARNING: No KEEP defined, defaulting to true...")

        keep = true;
    }
    else
    {
        if (keep == "FALSE")
        {
            keep = false;
        }
        else
        {
            // We default to not consuming records for safety
            keep = true;
        }
    }

    // Make sure the read mode is valid
    if (!(read_mode == "FIRST" || read_mode == "RANDOM"))
    {
        res.status(500).json({ message: 'ERROR: Read mode has to be FIRST or RANDOM.' });   

        // Capture response time for this route
        const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
        responseTimeInSec = responseTimeInMilliseconds / 1000;

        http_request_duration_seconds
            .labels(req.method, req.route.path, res.statusCode)
            .observe(responseTimeInSec)
    }


    // If the READ_MODE is RANDOM...
    if (read_mode == "RANDOM")
    {
        memory_manager.ReadRandom(filename,keep,(err,filename,record)=>{
                
            if(err)
            {
                console.log(err);
                res.status(500).json({ message: err }); 
            }
            else
            {
                //console.log("Loaded " + rows + " lines from " + filename + " into memory.");
                res.status(200).json({ record: record }); 
            }
            });

            // Capture response time for this route
            const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
            responseTimeInSec = responseTimeInMilliseconds / 1000;

            http_request_duration_seconds
                .labels(req.method, req.route.path, res.statusCode)
                .observe(responseTimeInSec)
    }
    
    // If the READ_MODE is FIRST...
    if (read_mode == "FIRST")
    {
        memory_manager.ReadFirst(filename,keep,(err,filename,record)=>{
                
            if(err)
            {
                console.log(err);
                res.status(500).json({ message: err }); 
            }
            else
            {
                //console.log("Loaded " + rows + " lines from " + filename + " into memory.");
                res.status(200).json({ record: record }); 
            }
            });

            // Capture response time for this route
            const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
            responseTimeInSec = responseTimeInMilliseconds / 1000;

            http_request_duration_seconds
                .labels(req.method, req.route.path, res.statusCode)
                .observe(responseTimeInSec)
    }

});



/****************************/
/* GET STATUS              
/****************************/
router.get('/dpm/STATUS', function(req, res) 
{
    memory_manager.Status((err,message)=>{

        if(err)
        {
            console.log(err);
            res.status(500).json({ message: message }); 
        }
        else
        {
            res.status(200).json({ message: message }); 
        }

        // Capture response time for this route
        const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
        responseTimeInSec = responseTimeInMilliseconds / 1000;

        http_request_duration_seconds
            .labels(req.method, req.route.path, res.statusCode)
            .observe(responseTimeInSec)
    });


});



/****************************/
/* GET INITFILE              
/****************************/
router.get('/dpm/INITFILE', function(req, res) 
{
    // Prometheus custom metric for count of HTTP requests
    http_request_counter.labels({route: '/dpm/INITFILE', statusCode: res.statusCode}).inc();

    // Extract the query string parameters
    let qsp = url.parse(req.url, true).query;

    // If the user did not specify a filename
    if (!req.query.FILENAME)
    {
        res.status(500).json({ message: 'ERROR: You need to specify a filename.' });   
    }

    console.log("INFO: About to retrieve record " + req.query.FILENAME);

    memory_manager.Load(req.query.FILENAME, csv_path, (err,message,filename,rows)=>{

        if(err)
        {
            console.log(err);
            res.status(500).json({ message: message }); 
        }
        else
        {
            console.log("INFO: Loaded " + rows + " lines from " + filename + " into memory.");
            res.status(200).json({ filename: filename, recorded_loaded: rows }); 
        }

        // Capture response time for this route
        const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
        responseTimeInSec = responseTimeInMilliseconds / 1000;

        http_request_duration_seconds
            .labels(req.method, req.route.path, res.statusCode)
            .observe(responseTimeInSec)
    });


});



/****************************/
/* METRICS ENDPOINT              
/****************************/
router.get('/metrics', function(req, res)
{
    // This code is for testing delays / timings
    //var waitTill = new Date(new Date().getTime() + 1 * 1000);
    //while(waitTill > new Date()){}

    res.setHeader('Content-Type',register.contentType)

    register.metrics().then(data => res.status(200).send(data))

    // Capture response time for this route
    const responseTimeInMilliseconds = Date.now() - res.locals.startEpoch;
    responseTimeInSec = responseTimeInMilliseconds / 1000;

    http_request_duration_seconds
        .labels(req.method, req.route.path, res.statusCode)
        .observe(responseTimeInSec)
});


// A dummy for if we wanted to retrieve a record
// There is an expected query string parameter "datapool"


// Register our routes
app.use('/', router);

// Start the server
app.listen(port);
console.log('INFO: Datapool Manager now running on port ' + port);
