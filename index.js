module.exports = async function dsAppLabels(request, response, next) {
  const transactionType = "CustomerPayBillOnline";

  const axios = require("axios");
  require("dotenv").config();

  const darajaApiAuthUrl = process.env.DARAJA_API_AUTH_URL;
  const darajaApiStkPushUrl = process.env.DARAJA_API_STK_PUSH_URL;
  const darajaApiBsShortCode = process.env.DARAJA_API_BS_SHORT_CODE;
  const darajaApiPasskey = process.env.DARAJA_API_PASSKEY;
  const darajaApiConsumerKey = process.env.DARAJA_API_CONSUMER_KEY;
  const darajaAPiConsumerSecret = process.env.DARAJA_API_CONSUMER_SECRET;
  const darajaApiWebhookUrl = process.env.DARAJA_API_WEBHOOK_URL;

  const darajaApiAuthUrlIsUndefined = {
    isPresent: !Boolean(darajaApiAuthUrl),
    errorMessage: "Missing Daraja API configuration: DARAJA AUTH URL",
  };
  const darajaApiStkPushUrlIsUndefined = {
    isPresent: !Boolean(darajaApiStkPushUrl),
    errorMessage: "Missing Daraja API configuration: DARAJA STK PUSH URL",
  };
  const darajaApiBsShortCodeIsUndefined = {
    isPresent: !Boolean(darajaApiBsShortCode),
    errorMessage: "Missing Daraja API configuration: DARAJA BS SHORT CODE",
  };
  const darajaApiPasskeyIsUndefined = {
    isPresent: !Boolean(darajaApiPasskey),
    errorMessage: "Missing Daraja API confuguration: DARAJA API PASSKEY",
  };

  const darajaApiConsumerKeyIsUndefined = {
    isPresent: !Boolean(darajaApiConsumerKey),
    errorMessage: "Missing Daraja API confuguration: DARAJA API CONSUMER KEY",
  };
  const darajaApiConsumerSecretIsUndefined = {
    isPresent: !Boolean(darajaAPiConsumerSecret),
    errorMessage:
      "Missing Daraja API confuguration: DARAJA API CONSUMER SECRET",
  };
  const darajaApiWebhookUrlIsUndefined = {
    isPresent: !Boolean(darajaApiWebhookUrl),
    errorMessage: "Missing Daraja API confuguration: DARAJA API WEBHOOK",
  };

  const configurationErrors = [
    darajaApiAuthUrlIsUndefined,
    darajaApiStkPushUrlIsUndefined,
    darajaApiBsShortCodeIsUndefined,
    darajaApiPasskeyIsUndefined,
    darajaApiConsumerSecretIsUndefined,
  ]
    .map((err) => (err.isPresent ? err : err.isPresent))
    .filter(Boolean);

  const hasConfigurationErrors = configurationErrors.length;

  if (hasConfigurationErrors) {
    response.status(500);
    return response.send({
      msg: "Daraja API configuration error",
      desc: configurationErrors,
    });
  }

  let consmerKeyandSecretBuffer = Buffer.from(
    darajaApiConsumerKey + ":" + darajaAPiConsumerSecret
  );
  let darajaApiBasicAuth = `Basic ${consmerKeyandSecretBuffer.toString(
    "base64"
  )}`;

  try {
    let { data } = await axios.get(darajaApiAuthUrl, {
      headers: {
        Authorization: darajaApiBasicAuth,
      },
    });

    const darajaApiAccessToken = data.access_token;

    async function handleStkPush({
      amount,
      phone,
      accountReference,
      transactionDesc,
    }) {
      const darajaApiBearerAccessToken = `Bearer ${darajaApiAccessToken}`;
      const requestTimeStamp = getTimestamp();
      const formattedPass = `${darajaApiBsShortCode}${darajaApiPasskey}${requestTimeStamp}`;
      const password = Buffer.from(formattedPass).toString("base64");
      const partyB = darajaApiBsShortCode;

      const formattedPhoneNumner = getFormatedPhoneNumber(
        response,
        request.body.phone
      );
      const validatedAmount = validateAmount(
        response,
        parseInt(request.body.amount)
      );

      const requestData = {
        BusinessShortCode: darajaApiBsShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: transactionType,
        Amount: validatedAmount,
        PartyA: formattedPhoneNumner,
        PartyB: partyB,
        PhoneNumber: formattedPhoneNumner,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc,
        CallBackURL: darajaApiWebhookUrl,
      };
      let requestConfig = {
        headers: {
          Authorization: darajaApiBearerAccessToken,
        },
      };

      try {
        await axios
          .post(darajaApiStkPushUrl, requestData, requestConfig)
          .then((res) => {
            response.json({
              success: true,
              message: res.data,
            });
          })
          .catch((e) => {
            response.status(500);
            return response.json({ msg: e });
          });
      } catch (e) {
        response.status(500);
        return response.json({ msg: e });
      }
    }

    request["lipaNaMpesa"] = handleStkPush;
    next();
  } catch (e) {
    response.status(500);
    return response.send({
      msg: "Daraja API error",
      desc: e,
    });
  }
};

function getFormatedPhoneNumber(response, phoneNumber) {
  let formatted = parseInt(`254${phoneNumber.substring(1)}`);
  if (numberIsValid(formatted)) return formatted;
  response.status(400);
  return response.json({ msg: "Invalid phone number" });
}

function numberIsValid(formatted) {
  let _pattern =
    /^(?:254|\+254|0)?(7(?:(?:[129][0-9])|(?:0[0-8])|(4[0-1]))[0-9]{6})$/;
  return _pattern.test(formatted);
}

const validateAmount = (response, amount) => {
  if (isNaN(amount) || amount < 1) {
    response.status(400);
    return response.json({ msg: "Amount must be a valid integer" });
  }
  return amount;
};

function getTimestamp() {
  let date = new Date();

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  return (
    date.getFullYear() +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    pad2(date.getHours()) +
    pad2(date.getMinutes()) +
    pad2(date.getSeconds())
  );
}
