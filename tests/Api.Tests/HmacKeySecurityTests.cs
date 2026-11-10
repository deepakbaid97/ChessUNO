using System;
using System.Text;
using ChessUno.Core.Sessions;
using Xunit;

namespace Api.Tests;

[Collection("NonParallelTokenHasherTests")]
public class HmacKeySecurityTests : IDisposable
{
    private const string DefaultTestKey = "ChessUnoDefaultGlobalTestKeyMustBe32BytesMin!";
    private static readonly string Valid32ByteKey = "TestHmacKeyMustBeAtLeast32BytesLong!";
    private static readonly string Secondary32ByteKey = "SecondaryHmacKeyAlso32BytesMinimum!";

    public HmacKeySecurityTests()
    {
        TokenHasher.Initialize(DefaultTestKey);
    }

    public void Dispose()
    {
        TokenHasher.Initialize(DefaultTestKey);
    }

    [Fact]
    public void TokenHasher_WithoutInitialization_ThrowsInvalidOperationException()
    {
        try
        {
            TokenHasher.ResetForTesting();

            Assert.False(TokenHasher.IsInitialized);
            var ex1 = Assert.Throws<InvalidOperationException>(() => TokenHasher.HashToken("some-token"));
            Assert.Contains("HMAC key has not been configured", ex1.Message);

            var ex2 = Assert.Throws<InvalidOperationException>(() => TokenHasher.VerifyToken("some-token", "some-hash"));
            Assert.Contains("HMAC key has not been configured", ex2.Message);
        }
        finally
        {
            TokenHasher.Initialize(DefaultTestKey);
        }
    }

    [Fact]
    public void TokenHasher_WithWeakKey_ThrowsArgumentException()
    {
        try
        {
            TokenHasher.ResetForTesting();

            // Less than 32 bytes (e.g. 16 bytes or empty)
            Assert.Throws<ArgumentException>(() => TokenHasher.Initialize("too-short-key"));
            Assert.Throws<ArgumentException>(() => TokenHasher.Initialize(new byte[16]));
            Assert.Throws<ArgumentException>(() => TokenHasher.Initialize(""));
        }
        finally
        {
            TokenHasher.Initialize(DefaultTestKey);
        }
    }

    [Fact]
    public void TokenHasher_WithStrongKey_Succeeds()
    {
        try
        {
            TokenHasher.ResetForTesting();
            TokenHasher.Initialize(Valid32ByteKey);

            Assert.True(TokenHasher.IsInitialized);
            var hash = TokenHasher.HashToken("my-secret-token");
            Assert.False(string.IsNullOrWhiteSpace(hash));
            Assert.Equal(64, hash.Length); // 256 bits = 64 hex characters

            Assert.True(TokenHasher.VerifyToken("my-secret-token", hash));
            Assert.False(TokenHasher.VerifyToken("wrong-token", hash));
        }
        finally
        {
            TokenHasher.Initialize(DefaultTestKey);
        }
    }

    [Fact]
    public void TokenHasher_WithKeyRotation_SupportsPreviousKeyGracePeriod()
    {
        try
        {
            TokenHasher.ResetForTesting();
            TokenHasher.Initialize(Valid32ByteKey);

            var originalToken = "session-player-token-xyz";
            var legacyHash = TokenHasher.HashToken(originalToken);

            // Rotate key: Secondary becomes primary, Valid32ByteKey becomes previous
            TokenHasher.Initialize(Secondary32ByteKey, Valid32ByteKey);

            // Verification of legacy token hash with previous key should succeed
            Assert.True(TokenHasher.VerifyToken(originalToken, legacyHash));

            // New hashes are generated with the new primary key
            var newHash = TokenHasher.HashToken(originalToken);
            Assert.NotEqual(legacyHash, newHash);
            Assert.True(TokenHasher.VerifyToken(originalToken, newHash));

            // If rotated again without previous key, legacy hash is now rejected
            TokenHasher.Initialize(Secondary32ByteKey, previousKeyString: null);
            Assert.False(TokenHasher.VerifyToken(originalToken, legacyHash));
            Assert.True(TokenHasher.VerifyToken(originalToken, newHash));
        }
        finally
        {
            TokenHasher.Initialize(DefaultTestKey);
        }
    }
}
