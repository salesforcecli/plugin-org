# summary

Makes an authenticated HTTP request to the Salesforce REST API and prints the response.

# description

You must specify a Salesforce org to use, either with the --target-org flag or by setting your default org with
the `target-org` configuration variable.

# examples

- List information about limits in your org <%= config.bin %> <%= command.id %> 'services/data/v56.0/limits'
  --target-org my-org
- Get response in XML format by specifying the "Accept" HTTP header:
  <%= config.bin %> <%= command.id %> 'services/data/v56.0/limits' --target-org my-org --header 'Accept:
  application/xml',

# flags.include.summary

Include HTTP response status and headers in the output.

# flags.method.summary

The HTTP method for the request.

# flags.header.summary

HTTP header in "key:value" format.

# flags.stream-to-file.summary

Stream responses to file.

# flags.body.summary

The file to use as the body for the request (use "-" to read from standard input, use "" for an empty body).
