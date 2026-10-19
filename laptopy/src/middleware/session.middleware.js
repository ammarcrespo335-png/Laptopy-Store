/** Sets req.user (or null) from the session cookie. Never rejects the request. */
export const attachUser = (sessions) => (req, _res, next) => {
  req.user = sessions.read(req);
  next();
};
