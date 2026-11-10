/**
 * Customer Account & Address Domain Service
 * Complies with PRD Section 6.6 (FR-ACCOUNT-004, FR-ACCOUNT-005),
 * Section 18.1, Section 18.2 (Anti-IDOR Protection), and ADR-005.
 *
 * Security Invariants:
 * 1. Anti-IDOR: Every address query MUST be explicitly scoped by `userId`.
 *    A customer can NEVER view, mutate, or delete an address belonging to another customer.
 * 2. Default Address Guarantee: Marking an address as default atomically clears default status
 *    on any other addresses owned by the user.
 * 3. Cascade Protection: Deleting an address safely unlinks `defaultShippingAddressId` or
 *    `defaultBillingAddressId` from `CustomerProfile`.
 */

import { prisma } from "../../lib/db";
import { CreateAddressInput, UpdateAddressInput } from "../../lib/validations/auth.schema";

export class CustomerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "CustomerError";
  }
}

export interface CustomerProfileView {
  userId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  defaultShippingAddressId: string | null;
  defaultBillingAddressId: string | null;
  createdAt: Date;
}

export class CustomersService {
  /**
   * Retrieves customer profile by authenticated user ID.
   */
  async getProfile(userId: string): Promise<CustomerProfileView> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user) {
      throw new CustomerError("NOT_FOUND", "Customer profile not found.", 404);
    }

    return {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.customerProfile?.firstName ?? "",
      lastName: user.customerProfile?.lastName ?? "",
      defaultShippingAddressId:
        user.customerProfile?.defaultShippingAddressId ?? null,
      defaultBillingAddressId:
        user.customerProfile?.defaultBillingAddressId ?? null,
      createdAt: user.createdAt,
    };
  }

  /**
   * Updates customer profile details (name and phone).
   */
  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string | null }
  ): Promise<CustomerProfileView> {
    await prisma.$transaction(async (tx) => {
      if (data.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { phone: data.phone },
        });
      }

      if (data.firstName !== undefined || data.lastName !== undefined) {
        await tx.customerProfile.upsert({
          where: { userId },
          update: {
            ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
            ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
          },
          create: {
            userId,
            firstName: data.firstName?.trim() ?? "",
            lastName: data.lastName?.trim() ?? "",
          },
        });
      }
    });

    return this.getProfile(userId);
  }

  /**
   * Lists all addresses owned by the authenticated customer.
   */
  async listAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * Retrieves a single address with strict IDOR prevention.
   */
  async getAddress(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId, // Strict IDOR boundary
      },
    });

    if (!address) {
      throw new CustomerError("NOT_FOUND", "Address not found.", 404);
    }

    return address;
  }

  /**
   * Creates an address for the authenticated customer.
   */
  async createAddress(userId: string, input: CreateAddressInput) {
    return prisma.$transaction(async (tx) => {
      // If setting as default, unset other defaults for this user
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const address = await tx.address.create({
        data: {
          userId,
          type: input.type,
          recipientName: input.recipientName,
          streetLine1: input.streetLine1,
          streetLine2: input.streetLine2 || null,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          isDefault: input.isDefault ?? false,
        },
      });

      // If user profile has no default address set, link this one automatically
      const profile = await tx.customerProfile.findUnique({
        where: { userId },
      });

      if (profile && (!profile.defaultShippingAddressId || input.isDefault)) {
        await tx.customerProfile.update({
          where: { userId },
          data: {
            defaultShippingAddressId: address.id,
            ...(profile.defaultBillingAddressId ? {} : { defaultBillingAddressId: address.id }),
          },
        });
      }

      return address;
    });
  }

  /**
   * Updates an address with strict IDOR ownership verification.
   */
  async updateAddress(
    userId: string,
    addressId: string,
    input: UpdateAddressInput
  ) {
    // IDOR verification pre-check
    await this.getAddress(userId, addressId);

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Atomic IDOR update directly scoping userId
      const updateResult = await tx.address.updateMany({
        where: { id: addressId, userId },
        data: {
          ...(input.recipientName ? { recipientName: input.recipientName } : {}),
          ...(input.type ? { type: input.type } : {}),
          ...(input.streetLine1 ? { streetLine1: input.streetLine1 } : {}),
          ...(input.streetLine2 !== undefined ? { streetLine2: input.streetLine2 || null } : {}),
          ...(input.city ? { city: input.city } : {}),
          ...(input.state ? { state: input.state } : {}),
          ...(input.postalCode ? { postalCode: input.postalCode } : {}),
          ...(input.countryCode ? { countryCode: input.countryCode } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
      });

      if (updateResult.count === 0) {
        throw new CustomerError("NOT_FOUND", "Address not found.", 404);
      }

      const updated = await tx.address.findFirstOrThrow({
        where: { id: addressId, userId },
      });

      if (input.isDefault) {
        await tx.customerProfile.update({
          where: { userId },
          data: { defaultShippingAddressId: updated.id },
        });
      }

      return updated;
    });
  }

  /**
   * Deletes an address with strict IDOR ownership verification.
   */
  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    // IDOR verification pre-check
    await this.getAddress(userId, addressId);

    await prisma.$transaction(async (tx) => {
      // Unlink from customer profile if it was marked default
      await tx.customerProfile.updateMany({
        where: {
          userId,
          defaultShippingAddressId: addressId,
        },
        data: { defaultShippingAddressId: null },
      });

      await tx.customerProfile.updateMany({
        where: {
          userId,
          defaultBillingAddressId: addressId,
        },
        data: { defaultBillingAddressId: null },
      });

      // Atomic IDOR delete query explicitly scoping userId
      const deleteResult = await tx.address.deleteMany({
        where: { id: addressId, userId },
      });

      if (deleteResult.count === 0) {
        throw new CustomerError("NOT_FOUND", "Address not found.", 404);
      }
    });

    return true;
  }
}

export const customersService = new CustomersService();
