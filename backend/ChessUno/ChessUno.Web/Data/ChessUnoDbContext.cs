using Microsoft.EntityFrameworkCore;

namespace ChessUno.Web.Data;

public class ChessUnoDbContext : DbContext
{
    public ChessUnoDbContext(DbContextOptions<ChessUnoDbContext> options)
        : base(options)
    {
    }

    public DbSet<GameSessionEntity> Sessions => Set<GameSessionEntity>();
    public DbSet<GameActionEntity> Actions => Set<GameActionEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<GameSessionEntity>(entity =>
        {
            entity.HasKey(e => e.GameId);
            entity.HasIndex(e => e.InvitationTokenHash).IsUnique();
            entity.HasIndex(e => e.Status);
            entity.Property(e => e.SnapshotJson).HasColumnType("text");
        });

        modelBuilder.Entity<GameActionEntity>(entity =>
        {
            entity.HasKey(e => new { e.GameId, e.ActionId });
            entity.HasIndex(e => e.GameId);
        });
    }
}
