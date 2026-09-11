// Node's fetch() wraps low-level network failures (DNS, connection refused,
// TLS) in a generic `TypeError: fetch failed` and attaches the real reason as
// `error.cause`. Surface that cause so users see what actually went wrong
// instead of the generic message.
function formatAdapterError(error) {
  const cause = error?.cause;
  const causeDetail = cause?.message || cause?.code;
  return causeDetail ? `${error.message}: ${causeDetail}` : error.message;
}

module.exports = { formatAdapterError };
