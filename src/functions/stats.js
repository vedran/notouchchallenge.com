const { google } = require("googleapis");
const atob = require("atob");

exports.handler = function(event, context, callback) {
  const scopes = "https://www.googleapis.com/auth/analytics.readonly";

  const jwt = new google.auth.JWT(
    process.env.CLIENT_EMAIL,
    null,
    atob(process.env.PRIVATE_KEY),
    scopes
  );

  jwt
    .authorize()
    .then(jwtResponse => {
      google
        .analytics("v3")
        .data.ga.get({
          auth: jwt,
          ids: "ga:213332846",
          "start-date": "60daysAgo",
          "end-date": "today",
          metrics: "ga:pageviews"
        })
        .then(resp => {
          callback(null, {
            statusCode: 200,
            headers: { "Cache-Control": "public, s-maxage=60" },
            body: JSON.stringify({
              total: resp.data.rows[0][0]
            })
          });
        })
        .catch(err => {
          console.log(err);
          callback(null, {
            body: JSON.stringify({
              total: null
            })
          });
        });
    })
    .catch(err => {
      console.log(err);
      callback(null, {
        body: JSON.stringify({
          total: null
        })
      });
    });
};
