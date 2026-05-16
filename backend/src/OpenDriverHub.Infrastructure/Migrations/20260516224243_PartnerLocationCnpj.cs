using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenDriverHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PartnerLocationCnpj : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Partners",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Cnpj",
                table: "Partners",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "Lat",
                table: "Partners",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "Lng",
                table: "Partners",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "Partners",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "City",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "Cnpj",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "Lat",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "Lng",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "State",
                table: "Partners");
        }
    }
}
