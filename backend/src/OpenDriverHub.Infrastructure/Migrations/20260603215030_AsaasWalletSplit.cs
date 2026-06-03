using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenDriverHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AsaasWalletSplit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AsaasWalletId",
                table: "Partners",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AsaasWalletId",
                table: "Partners");
        }
    }
}
