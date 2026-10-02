/**
 * Gmail OAuth helper.
 *
 * Owns authentication for the project so every command uses the same scopes
 * and token lifecycle.
 *
 * Local-only files (never commit these):
 *   credentials.json - OAuth client downloaded from Google Cloud.
 *   token.json       - Refresh token created after interactive login.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {authenticate} from "@google-cloud/local-auth";
import {google} from "googleapis";

/*
 * gmail.settings.basic: manage Gmail filters.
 * gmail.labels: manage labels used by rules.
 * gmail.modify: search messages and apply historical labels/archive/trash actions.
 *
 * gmail.metadata is not enough for inventory.js because Gmail does not permit
 * messages.list q searches when authenticated only with the metadata scope.
 */
export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
];

/**
 * Reuse token.json when possible. If it is missing, invalid, or predates the
 * gmail.modify scope, launch Google's local OAuth flow and save a new token.
 *
 * If scopes change in the future, deleting token.json safely forces
 * reauthorization on the next run.
 */
export async function getAuth() {
  const credentialsPath = path.join(process.cwd(), "credentials.json");
  const tokenPath = path.join(process.cwd(), "token.json");

  try {
    const savedToken = JSON.parse(await fs.readFile(tokenPath, "utf8"));
    if (!savedToken.scopes?.includes("https://www.googleapis.com/auth/gmail.modify")) {
      throw new Error("OAuth scope upgrade required");
    }
    return google.auth.fromJSON(savedToken);
  } catch {
    // First run, corrupt token, or scope upgrade: authenticate below.
  }

  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: credentialsPath,
  });

  const credentialsFile = JSON.parse(await fs.readFile(credentialsPath, "utf8"));
  const oauthClient = credentialsFile.installed || credentialsFile.web;

  await fs.writeFile(
    tokenPath,
    JSON.stringify(
      {
        type: "authorized_user",
        client_id: oauthClient.client_id,
        client_secret: oauthClient.client_secret,
        refresh_token: client.credentials.refresh_token,
        scopes: SCOPES,
      },
      null,
      2,
    ),
  );

  return client;
}
