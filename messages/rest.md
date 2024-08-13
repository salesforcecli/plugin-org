# summary

Make an authenticated HTTP request to Salesforce REST API and print the response.

# examples

- List information about limits in the org with alias "my-org":

    <%= config.bin %> <%= command.id %> 'services/data/v56.0/limits' --target-org my-org

- Get the response in XML format by specifying the "Accept" HTTP header:

    <%= config.bin %> <%= command.id %> 'services/data/v56.0/limits' --target-org my-org --header 'Accept: application/xml',

# flags.include.summary

Include the HTTP response status and headers in the output.

# flags.method.summary

HTTP method for the request.

# flags.header.summary

HTTP header in "key:value" format.

# flags.stream-to-file.summary

Stream responses to a file.

# flags.body.summary

File to use as the body for the request. Specify "-" to read from standard input; specify "" for an empty body.
