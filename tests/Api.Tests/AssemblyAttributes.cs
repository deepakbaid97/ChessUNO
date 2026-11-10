using Xunit;

// Disable parallel test execution within Api.Tests because PostgreSQL migrations and
// TokenHasher static HMAC configuration require deterministic serial test execution.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
