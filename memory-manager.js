/**
 * This module handled the in-memory structure which holds all the datapools.
 */
const path = require('path');

// A dictionary of arrays, indexed by filename, which will contain all the lines of data from each CSV
global.file_lists = {};

// A dictionary of the cursor position of each datapool
global.cursor_positions = {};



/**
 * Clear all the data from memory
 */
exports.ClearAll = function(callback)
{
    // By creating new empty objecs, the existing dictionaries will be garbage collected (in theory)
    file_lists = {};
    cursor_positions = {};

    // Callback
    callback(null, "INFO: Cleared out all data from memory.");
}


/**
   Adds a new CSV file to memory and to disk - to create new datapools on the fly
 */
exports.Create = function(filename, line, csv_path, callback)
{
    // Write the code
    console.log("Inside the memory_manager Create function and here is the line: " + line + " and the csv_path: " + csv_path);

    // Create a blank file ready for use
    csv_path = AddPathSeparator(csv_path);

    const fs = require('fs');

    var stream = fs.createWriteStream(csv_path + filename, {flags:'wx'});


    stream.on('open', () => {
    console.log('File created successfully.');
    });

    stream.on('error', (err) => {
    if (err.code === 'EEXIST') {
        console.error(`File already exists: ${csv_path + filename}`);
        // Optionally: process.exit(1) or just return
    } else {
        console.error(`Error: ${err.message}`);
    }
    });

    // Now need to read this into memory or create the memory structure
    exports.Load(filename, csv_path, (err,message,filename,rows)=>{
        if(err)
        {
            console.log("Test data file " + filename + "does not exist!");
            console.log(err);
            callback(err, "Created + " + filename);            
        }
        else
        {
            console.log("INFO: Loaded " + rows + " lines from " + filename + " into memory.");
            callback(null, "Created + " + filename);
        }

    });

    
}

/**
   Loads a new CSV file into memory. 
*/
exports.Load = function(filename, csv_path, callback)
{
    // If the file is already in memory, throw an error
    if (filename in file_lists)
    {
        callback("ERROR: " + filename +" is already in memory!", "ERROR: " + filename +" is already in memory!", null, null);
    }
    else
    {
        console.log("INFO: Loading " + filename + " from " + csv_path + ' into memory.');

        // If CSV path does end with a path separator, add one
        if ( csv_path.endsWith('\\') || csv_path.endsWith('/') )
        {
            // Do nothing (we used to log something here)
        }
        else
        {
            console.log("INFO: File path does not end with a path separator, adding one...");
            csv_path = csv_path + path.sep;
        }

        // Create an array in memory for this datapool to be stored (indexed by filename)
        file_lists[filename] = [];

        // Read the file into memory synchronously (whole file)
        var lines = require('fs').readFileSync(csv_path + filename, 'utf-8')
            .split('\n')
            .filter(Boolean);

        // Add each line to our array in memory
        lines.forEach(function(line)
        {
            file_lists[filename].push(line.trim());
        });

        // Start the cursor position at the beginning
        cursor_positions[filename] = 0;

        // Callback
        callback(null, "Loaded + " + file_lists[filename].length + " lines from " + filename + " into memory.", filename, file_lists[filename].length);
    }
}



/**
   Save a datapool back to a file
*/
exports.Save = function(filename, csv_path, callback)
{
    csv_path = AddPathSeparator(csv_path);

    const fs = require('fs');

    var stream = fs.createWriteStream(csv_path + filename, {flags:'w'});

    for (var i = 0; i < file_lists[filename].length; i++) 
    {
        stream.write(file_lists[filename][i] + "\n");
    }

    stream.end();

    callback(null, filename);
}



/**
   Adds a record to the start of the datapool array.
*/
exports.AddFirst = function(filename, line, callback)
{
    file_lists[filename].unshift(line);

    cursor_positions[filename] = cursor_positions[filename] + 1;

    callback(null, line);
}



/**
   Adds a record to the end of the datapool array.
*/
exports.AddLast = function(filename, line, callback)
{
    file_lists[filename].push(line);

    callback(null, line);
}




/**
   Returns a random record.
*/
exports.ReadRandom = function(filename, keep, callback)
{
    // If the file requested does not exist in memory, throw an error
    if (!(filename in file_lists))
    {
        callback("ERROR: " + filename +" is not loaded into memory!", filename, null);
    }
    else
    {
        // If there are no records to return, throw an error
        if (file_lists[filename].length < 1)
        {
            callback("ERROR: " + filename +" has no more records!", filename, null);
        }
        else
        {
            // Calculate a random index in the array
            let randomIndex = getRandomInt(0,file_lists[filename].length-1);

            // Random record (we need to take a copy of it before potentially removing it)
            let randomRecord = file_lists[filename][randomIndex];

            // If we need to consume this record
            if (!keep)
            {
                // Remove the current record
                file_lists[filename].splice(randomIndex,1);

                // Reduce the cursor by 1 if required. Otherwise we could have a cursor position outside the size of
                // the array.
                if ( cursor_positions[filename] > randomIndex || cursor_positions[filename] > file_lists[filename].length)
                {
                    cursor_positions[filename] = cursor_positions[filename] - 1;
                }
            }

            callback(null, filename, randomRecord);
        }
    }
}


/**
   Returns the next sequential record.
*/
exports.ReadFirst = function(filename, keep, callback)
{
    // If the file requested does not exist in memory, throw an error
    if (!(filename in file_lists))
    {
        callback("ERROR: " + filename +" is not loaded into memory!", filename, null);
    }
    else
    {
        // If there are no records to return...
        if (file_lists[filename].length < 1)
        {
            callback("ERROR: " + filename +" has no more records!", filename, null);
        }
        else
        {
            // Position of the next record
            let cursorPosition = cursor_positions[filename];

            // Grab our record
            let nextRecord = file_lists[filename][cursor_positions[filename]];

            // If we need to consume this record...
            if (!keep)
            {
                // Remove the current record
                file_lists[filename].splice(cursorPosition,1);

                cursor_positions[filename] = cursor_positions[filename] - 1;
            }

            // Increment the cursor
            cursor_positions[filename] = cursor_positions[filename] + 1;

            // If we've reached the end of the data, go back to the start
            if ( cursor_positions[filename] >= file_lists[filename].length )
            {
                cursor_positions[filename] = 0;
            }

            callback(null, filename, nextRecord);
        }
    }
}


/**
   Returns each file loaded into memory + how many rows there are.
*/
exports.Status = function(callback)
{
    keys_and_counts = {};

    // Go through and print each key + number of values
    const keys = Object.keys(file_lists);
    keys.forEach(function(key)
    {
        keys_and_counts[key] = file_lists[key].length;
    });

    callback(null, keys_and_counts);
}



/**
   Internal function to calculate a random integer between a min and max
*/
function getRandomInt(min, max) 
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function AddPathSeparator(csv_path)
{
    // If CSV path does end with a path separator, add one
    if ( csv_path.endsWith('\\') || csv_path.endsWith('/') )
    {
        // Do nothing (we used to log something here)
    }
    else
    {
        //console.log("INFO: File path does not end with a path separator, adding one...");
        csv_path = csv_path + path.sep;
    }

    return csv_path;
}