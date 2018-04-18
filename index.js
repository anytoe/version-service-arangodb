'use strict';

// Imports the @arangodb/foxx/router module which provides a function for creating new Foxx routers
const createRouter = require('@arangodb/foxx/router');
const router = createRouter();

// DB access
const db = require('@arangodb').db;
const errors = require('@arangodb').errors;
const aql = require('@arangodb').aql;

// Parameters
const joi = require('joi');

const appVersionCollection = db._collection('appversion');
const DOC_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;

// Foxx context or service context
module.context.use(router);

// The router provides the methods get, post, etc corresponding to each HTTP verb as well as the catch-all all. 
// These methods indicate that the given route should be used to handle incoming requests with the given HTTP verb (or any method when using all).
router.get('/version/:project/:client/:version', function (req, res) {
  try {
    var version = req.pathParams.version.split(".");
    var major = version[0];
    var minor = version[1];
    var bug = version[2];

    var versionQuery = aql`
      FOR entry IN ${appVersionCollection}
      FILTER
          entry.project == ${req.pathParams.project}
          && entry.client == ${req.pathParams.client}
      RETURN entry`;

    var queryResult = db._query(versionQuery);

    var isLatest = true;
    var isEnabled = true;
    var minVersion = null;

    if (queryResult._countTotal === 1) {

      minVersion = queryResult._documents[0].minversion;

      isEnabled = minVersion.major < major
        || (minVersion.major == major && minVersion.minor < minor)
        || (minVersion.major == major && minVersion.minor == minor && minVersion.bug <= bug);

      //     	isLatest = minVersion.major > major
      //     		|| (minVersion.major == major && minVersion.minor > minor)
      //     		|| (minVersion.major == major && minVersion.minor == minor && minVersion.bug > bug);
    }

    var result = {
      project: req.pathParams.project,
      client: req.pathParams.client,
      clientVersion: req.pathParams.version,
      minVersion: minVersion ? minVersion.major + "." + minVersion.minor + "." + minVersion.bug : null,
      //     	isLatest: isLatest,
      isEnabled: isEnabled
    }

    res.send(result);
  } catch (e) {
    if (!e.isArangoError || e.errorNum !== DOC_NOT_FOUND) {
      throw e;
    }
    res.throw(404, 'The entry does not exist', e);
  }
})
  .pathParam('project', joi.string().required(), 'Name of the project')
  .pathParam('client', joi.string().required(), 'Name of the client application.')
  .pathParam('version', joi.string().required(), 'Version string, e.g. 3.2.7')
  .response(['application/json'], 'A personalized greeting.')
  .summary('Personalized greeting')
  .description('Returns a version');