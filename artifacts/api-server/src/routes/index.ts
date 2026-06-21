import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import businessesRouter from "./businesses";
import bookingsRouter from "./bookings";
import ordersRouter from "./orders";
import favoritesRouter from "./favorites";
import reviewsRouter from "./reviews";
import notificationsRouter from "./notifications";
import driversRouter from "./drivers";
import walletsRouter from "./wallets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(businessesRouter);
router.use(bookingsRouter);
router.use(ordersRouter);
router.use(favoritesRouter);
router.use(reviewsRouter);
router.use(notificationsRouter);
router.use(driversRouter);
router.use(walletsRouter);

export default router;
